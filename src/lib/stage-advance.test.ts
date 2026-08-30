import { describe, expect, it } from "vitest";
import type { ProjectType } from "@prisma/client";
import {
  PIPELINES,
  pipelineForType,
  stageForSectionName,
  type Pipeline,
  type PipelineId,
} from "./pipelines";
import { PROJECT_TEMPLATES } from "./project-templates";
import {
  stageAdvanceDetail,
  stageAdvanceOffer,
  stageAdvancePrompt,
  type AdvanceSection,
  type StageAdvanceInput,
} from "./stage-advance";

/**
 * THE ONE-CLICK ADVANCE.
 *
 * This is what decides whether the product nags. The owner's complaint was
 * that the status controls did not earn his trust; a prompt that fires on an
 * empty new project, or on a stage where the client is holding the job, would
 * confirm the complaint rather than answer it. So the tests below are named
 * after the WRONG BEHAVIOURS they forbid, not after the function.
 *
 * The three that matter most, and would each be a silent product bug:
 *   - offering to leave a waiting stage (no column maps to it — the product
 *     would be guessing about the PE, the client or the city);
 *   - offering on an empty column (zero of zero done is not done);
 *   - offering a stage that is not the registry's next one.
 *
 * No database and no network — DATABASE_URL points at PRODUCTION and
 * vitest.config.ts blanks it. Nothing here imports Prisma at runtime; the
 * ProjectType enum arrives as an erased type.
 */

const done = (n: number) => Array.from({ length: n }, () => ({ completed: true }));
const open = (n: number) => Array.from({ length: n }, () => ({ completed: false }));

/** A recertification, which is the job the firm actually runs. */
function recert(
  stage: string | null,
  sections: AdvanceSection[]
): StageAdvanceInput {
  return { type: "RECERTIFICATION" as ProjectType, stage, sections };
}

/** The five recertification stages that are pure waiting on somebody outside
 *  the firm. Copied from the sign-off, not derived: if a future stage stops
 *  being a waiting stage that is a product decision, and this list has to be
 *  edited by hand for these tests to keep meaning anything. */
const WAITING_STAGES = [
  "recert.awaiting_pe",
  "recert.submitted_to_client",
  "recert.awaiting_client_repairs",
  "recert.awaiting_client_fees",
  "recert.submitted_to_city",
];

describe("when the stage's work is finished", () => {
  it("offers the next stage in the pipeline", () => {
    const offer = stageAdvanceOffer(
      recert("recert.field_work", [
        { name: "Field Work", stage: "recert.field_work", tasks: done(6) },
      ])
    );

    expect(offer).not.toBeNull();
    expect(offer?.from.key).toBe("recert.field_work");
    expect(offer?.next.key).toBe("recert.report_drafting");
    expect(offer?.taskCount).toBe(6);
  });

  it("carries the holder the next stage lands on", () => {
    // The point of the whole design: the offer has to be able to say whose
    // desk one click puts the job on. Report Drafting is ours; the stage
    // after it is the PE's, and that is the click the firm hesitates over.
    const toDrafting = stageAdvanceOffer(
      recert("recert.field_work", [
        { stage: "recert.field_work", tasks: done(1) },
      ])
    );
    expect(toDrafting?.next.holder).toBe("FIRM");

    const toPe = stageAdvanceOffer(
      recert("recert.report_drafting", [
        { stage: "recert.report_drafting", tasks: done(3) },
      ])
    );
    expect(toPe?.next.key).toBe("recert.awaiting_pe");
    expect(toPe?.next.holder).toBe("PE");
  });

  it("names the column that earned it", () => {
    // The recert template's column is "Inspection & Reports" while the stage
    // is "Field Work" — the two vocabularies this feature exists to join.
    const offer = stageAdvanceOffer(
      recert("recert.field_work", [
        { name: "Inspection & Reports", stage: "recert.field_work", tasks: done(4) },
      ])
    );
    expect(offer?.sectionName).toBe("Inspection & Reports");
  });
});

describe("when it must stay quiet", () => {
  it("says nothing on a stage no column is mapped to", () => {
    // THE DESIGN DECISION. Every other column on the board is finished; the
    // job is on the PE's desk and nothing on this board can know whether he
    // has signed. Offering here would be the product inventing a fact.
    for (const stage of WAITING_STAGES) {
      const offer = stageAdvanceOffer(
        recert(stage, [
          { name: "Kickoff", stage: "recert.draft", tasks: done(3) },
          { name: "Field Work", stage: "recert.field_work", tasks: done(6) },
          { name: "Report Drafting", stage: "recert.report_drafting", tasks: done(2) },
          { name: "Punch list", stage: null, tasks: done(5) },
        ])
      );
      expect(offer, `${stage} has no column of its own and must not be offered`).toBeNull();
    }
  });

  it("says nothing on an empty column", () => {
    // Zero of zero is not an accomplishment. This is the case that would fire
    // on every project the moment it is created from the template.
    const offer = stageAdvanceOffer(
      recert("recert.field_work", [
        { name: "Field Work", stage: "recert.field_work", tasks: [] },
      ])
    );
    expect(offer).toBeNull();
  });

  it("says nothing on a column whose tasks are missing entirely", () => {
    // A payload that omitted `tasks` is not a finished column either; it is a
    // column nobody counted.
    expect(
      stageAdvanceOffer(
        recert("recert.field_work", [{ stage: "recert.field_work" }])
      )
    ).toBeNull();
    expect(
      stageAdvanceOffer(
        recert("recert.field_work", [{ stage: "recert.field_work", tasks: null }])
      )
    ).toBeNull();
  });

  it("says nothing while one task is still open", () => {
    const offer = stageAdvanceOffer(
      recert("recert.field_work", [
        { stage: "recert.field_work", tasks: [...done(9), ...open(1)] },
      ])
    );
    expect(offer).toBeNull();
  });

  it("ignores columns mapped to a different stage", () => {
    // A finished Field Work column says nothing about a job that has already
    // moved on to Report Drafting.
    const offer = stageAdvanceOffer(
      recert("recert.report_drafting", [
        { name: "Field Work", stage: "recert.field_work", tasks: done(6) },
      ])
    );
    expect(offer).toBeNull();
  });

  it("ignores free-form columns", () => {
    // Most columns on most boards carry no stage at all. A finished one is
    // not evidence about any stage.
    const offer = stageAdvanceOffer(
      recert("recert.field_work", [
        { name: "Ideas", stage: null, tasks: done(4) },
        { name: "Admin", tasks: done(2) },
      ])
    );
    expect(offer).toBeNull();
  });

  it("says nothing at the end of the pipeline", () => {
    const offer = stageAdvanceOffer(
      recert("recert.recertified", [
        { stage: "recert.recertified", tasks: done(3) },
      ])
    );
    expect(offer).toBeNull();
  });

  it("says nothing when the project has no stage, no type, or no columns", () => {
    const finished: AdvanceSection[] = [
      { stage: "recert.field_work", tasks: done(3) },
    ];
    expect(stageAdvanceOffer(recert(null, finished))).toBeNull();
    expect(
      stageAdvanceOffer({ type: null, stage: "recert.field_work", sections: finished })
    ).toBeNull();
    expect(stageAdvanceOffer(recert("recert.field_work", []))).toBeNull();
    expect(
      stageAdvanceOffer({
        type: "RECERTIFICATION" as ProjectType,
        stage: "recert.field_work",
        sections: null,
      })
    ).toBeNull();
  });

  it("says nothing when the stage belongs to another pipeline", () => {
    // The type was changed under a live job, so the stored key is not a
    // position in this job's strip. Advancing it would move the job into a
    // pipeline it does not run.
    const offer = stageAdvanceOffer({
      type: "RECERTIFICATION" as ProjectType,
      stage: "design.design_work",
      sections: [{ stage: "design.design_work", tasks: done(3) }],
    });
    expect(offer).toBeNull();
  });

  it("says nothing for a stage key that no longer resolves", () => {
    const offer = stageAdvanceOffer(
      recert("recert.site_visit_OLD", [
        { stage: "recert.site_visit_OLD", tasks: done(3) },
      ])
    );
    expect(offer).toBeNull();
  });
});

describe("when a stage is split across more than one column", () => {
  it("requires every one of them to be finished", () => {
    const offer = stageAdvanceOffer(
      recert("recert.field_work", [
        { name: "Field Work — exterior", stage: "recert.field_work", tasks: done(4) },
        { name: "Field Work — electrical", stage: "recert.field_work", tasks: open(2) },
      ])
    );
    expect(offer).toBeNull();
  });

  it("counts all of them together", () => {
    const offer = stageAdvanceOffer(
      recert("recert.field_work", [
        { name: "Field Work — exterior", stage: "recert.field_work", tasks: done(4) },
        { name: "Field Work — electrical", stage: "recert.field_work", tasks: done(2) },
      ])
    );
    expect(offer?.taskCount).toBe(6);
  });

  it("still refuses when the only mapped columns are empty", () => {
    const offer = stageAdvanceOffer(
      recert("recert.field_work", [
        { stage: "recert.field_work", tasks: [] },
        { stage: "recert.field_work", tasks: [] },
      ])
    );
    expect(offer).toBeNull();
  });

  it("names the first column that actually has a name", () => {
    const offer = stageAdvanceOffer(
      recert("recert.field_work", [
        { name: "   ", stage: "recert.field_work", tasks: done(1) },
        { name: "Inspection & Reports", stage: "recert.field_work", tasks: done(1) },
      ])
    );
    expect(offer?.sectionName).toBe("Inspection & Reports");
  });
});

describe("the stage it offers is always the registry's next one", () => {
  const TYPE_FOR_PIPELINE: Record<PipelineId, ProjectType> = {
    recert: "RECERTIFICATION" as ProjectType,
    design: "DESIGN" as ProjectType,
    permit: "PERMIT" as ProjectType,
    construction: "CONSTRUCTION" as ProjectType,
  };

  const pipelines: Pipeline[] = (Object.keys(PIPELINES) as PipelineId[]).map(
    (id) => PIPELINES[id]
  );

  for (const pipeline of pipelines) {
    it(`walks ${pipeline.label} one stage at a time and stops at the end`, () => {
      // Generative on purpose: adjacency is pipelines.ts's job, and this
      // proves the advance never invents its own order — including that it
      // never skips the waiting stages, which is exactly what a derived
      // stage would have done.
      pipeline.stages.forEach((stage, i) => {
        const offer = stageAdvanceOffer({
          type: TYPE_FOR_PIPELINE[pipeline.id],
          stage: stage.key,
          sections: [{ name: stage.label, stage: stage.key, tasks: done(2) }],
        });
        const expected = pipeline.stages[i + 1];
        if (!expected) {
          expect(offer, `${stage.key} is terminal`).toBeNull();
          return;
        }
        expect(offer?.next.key, `after ${stage.key}`).toBe(expected.key);
        expect(offer?.next.label).toBe(expected.label);
        expect(offer?.next.holder).toBe(expected.holder);
      });
    });
  }
});

describe("what the owner reads", () => {
  const offer = stageAdvanceOffer(
    recert("recert.field_work", [
      { name: "Inspection & Reports", stage: "recert.field_work", tasks: done(6) },
    ])
  )!;

  it("asks the question in his words", () => {
    expect(stageAdvancePrompt(offer)).toBe(
      "All Field Work is done. Move to Report Drafting?"
    );
  });

  it("shows what was counted, and where", () => {
    expect(stageAdvanceDetail(offer)).toBe(
      "6 tasks in Inspection & Reports, all complete."
    );
  });

  it("says 'task' for exactly one", () => {
    const one = stageAdvanceOffer(
      recert("recert.field_work", [
        { name: "Inspection & Reports", stage: "recert.field_work", tasks: done(1) },
      ])
    )!;
    expect(stageAdvanceDetail(one)).toBe("1 task in Inspection & Reports, all complete.");
  });

  it("does not repeat the stage label when the column is named after it", () => {
    const same = stageAdvanceOffer(
      recert("recert.field_work", [
        { name: "field work", stage: "recert.field_work", tasks: done(3) },
      ])
    )!;
    expect(stageAdvanceDetail(same)).toBe("3 tasks, all complete.");
  });

  it("drops the column clause when the column has no name", () => {
    const anon = stageAdvanceOffer(
      recert("recert.field_work", [{ stage: "recert.field_work", tasks: done(2) }])
    )!;
    expect(stageAdvanceDetail(anon)).toBe("2 tasks, all complete.");
  });
});

describe("it is pure", () => {
  it("does not touch the sections it was given", () => {
    // It runs on every render of every project the firm opens; a mutation
    // here would be a rendering bug somewhere else entirely.
    const sections: AdvanceSection[] = [
      { name: "Field Work", stage: "recert.field_work", tasks: done(3) },
    ];
    const snapshot = JSON.stringify(sections);
    stageAdvanceOffer(recert("recert.field_work", sections));
    expect(JSON.stringify(sections)).toBe(snapshot);
  });

  it("gives the same answer twice", () => {
    const input = recert("recert.field_work", [
      { name: "Field Work", stage: "recert.field_work", tasks: done(3) },
    ]);
    expect(stageAdvanceOffer(input)).toEqual(stageAdvanceOffer(input));
  });
});

/**
 * THE BOARD THE FIRM ACTUALLY GETS.
 *
 * Everything above builds its own sections, which is how the first version of
 * this file proved a premise the shipped templates did not satisfy: it
 * asserted the waiting stages stay silent using boards that had no column for
 * them, while `recertification-40yr` had just given four of them one. And it
 * never noticed that the repair-loop tasks shared a column with the first
 * pass, which silenced the offer at Report Drafting, Awaiting PE Signature
 * and Submitted to City on every recertification the firm creates.
 *
 * So these run the real template through the real column→stage rule.
 */
function boardFromTemplate(templateId: string) {
  const template = PROJECT_TEMPLATES.find((t) => t.id === templateId);
  if (!template) throw new Error(`no template ${templateId}`);
  const type = (template.defaults.type ?? null) as ProjectType | null;
  const tasks = template.tasks ?? [];
  const sections: AdvanceSection[] = template.sections.map((name) => ({
    name,
    // Exactly what POST /api/projects stores on Section.stage for a gallery
    // pick, which sends column NAMES and nothing else.
    stage: stageForSectionName(type, name)?.key ?? null,
    tasks: tasks.filter((t) => t.section === name).map(() => ({ completed: true })),
  }));
  return { type, sections, template };
}

describe("the recertification template's own board", () => {
  it("files every task into a column that exists", () => {
    // A task naming a column the template does not create is dropped
    // silently at provisioning — the engineer opens the project and the work
    // is simply not there.
    for (const id of ["recertification-40yr", "broward-bsip-inspection", "building-safety-inspection"]) {
      const { template } = boardFromTemplate(id);
      const names = new Set(template.sections);
      const orphans = (template.tasks ?? [])
        .map((t) => t.section)
        .filter((s) => !names.has(s));
      expect(orphans, `${id} orphan tasks`).toEqual([]);
    }
  });

  it("offers at Report Drafting, Awaiting PE Signature and Submitted to City", () => {
    // The regression this guards: "Prepare updated reports" (due day 120, and
    // only if the Building Official asks for repairs) used to sit in the same
    // column as "Generate recertification reports" (due day 5). The offer
    // needs EVERY task in the column finished, so on day 5 the strip said
    // nothing at the three stages the firm passes through first.
    const { type, sections } = boardFromTemplate("recertification-40yr");
    for (const [from, next] of [
      ["recert.report_drafting", "recert.awaiting_pe"],
      ["recert.awaiting_pe", "recert.submitted_to_client"],
      ["recert.submitted_to_city", "recert.city_comments"],
    ]) {
      const offer = stageAdvanceOffer({ type, stage: from, sections });
      expect(offer, `no offer at ${from}`).not.toBeNull();
      expect(offer!.next.key).toBe(next);
    }
  });

  it("keeps the conditional repair loop in one deletable column", () => {
    // The template's own instruction is "do this section only if the Building
    // Official requires repairs (delete otherwise)". "This section" has to be
    // ONE column, or the engineer empties it and leaves second-pass work
    // alive on a job that already closed.
    const { template } = boardFromTemplate("recertification-40yr");
    const loop = [
      "Repairs required — do this section only if the Building Official requires repairs (delete otherwise)",
      "Repairs designed, permitted & built (separate design / construction project)",
      "Re-inspect completed repairs",
      "Prepare updated reports",
      "PE review, sign & seal updated reports (ready to sign)",
      "Owner resubmits updated reports to Building Official",
    ];
    const columns = new Set(
      loop.map((name) => {
        const task = (template.tasks ?? []).find((t) => t.name === name);
        expect(task, `template lost "${name}"`).toBeDefined();
        return task!.section;
      })
    );
    expect([...columns]).toHaveLength(1);
  });

  it("stays silent on every stage the client, the PE or the city is holding", () => {
    // Rule 1 read against the real board rather than a hand-made one: these
    // stages must have NO column, so the product never guesses that somebody
    // outside the firm has finished.
    const { type, sections } = boardFromTemplate("recertification-40yr");
    for (const waiting of [
      "recert.awaiting_client_repairs",
      "recert.reinspection",
      "recert.awaiting_client_fees",
    ]) {
      expect(
        sections.some((s) => s.stage === waiting),
        `${waiting} must not own a column`
      ).toBe(false);
      expect(stageAdvanceOffer({ type, stage: waiting, sections })).toBeNull();
    }
  });

  it("never offers anything but the registry's next stage", () => {
    for (const id of ["recertification-40yr", "broward-bsip-inspection", "building-safety-inspection"]) {
      const { type, sections } = boardFromTemplate(id);
      const pipeline = pipelineForType(type);
      expect(pipeline).not.toBeNull();
      pipeline!.stages.forEach((stage, i) => {
        const offer = stageAdvanceOffer({ type, stage: stage.key, sections });
        if (!offer) return;
        expect(offer.from.key).toBe(stage.key);
        expect(offer.next.key).toBe(pipeline!.stages[i + 1]?.key);
      });
    }
  });
});
