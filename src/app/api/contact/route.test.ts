import { beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/lib/ttc/site";
import { es } from "@/lib/ttc/site.es";

/**
 * POST /api/contact, end to end, with the two things it talks to replaced:
 * the database (DATABASE_URL is blanked for tests — it points at PRODUCTION)
 * and the mail provider. What is left is the route's own decisions, which is
 * where the form's promise is kept or broken:
 *
 *   • a county notice with no words is a complete request ("a phone photo of
 *     the letter is enough"), and only for the two county programs;
 *   • what the form adds for those programs, and where the request came
 *     from, reach the office without a database column;
 *   • none of it is ever echoed to the address the SENDER typed.
 */
const db = vi.hoisted(() => ({ rows: [] as { message: string; files: unknown }[] }));
const mail = vi.hoisted(() => ({
  sent: [] as { to: string; subject: string; html: string }[],
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    contactSubmission: {
      create: async ({ data }: { data: { message: string; files: unknown } }) => {
        db.rows.push(data);
        return { id: "cmtest00000000000ab12cd34", ...data };
      },
    },
  },
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (m: { to: string; subject: string; html: string }) => {
        mail.sent.push(m);
        return { data: { id: "test" }, error: null };
      },
    };
  },
}));

import { POST } from "./route";

const label = (c: { services: readonly { slug: string; shortTitle: string }[] }, slug: string) =>
  c.services.find((s) => s.slug === slug)!.shortTitle;
const RECERT = label(en, "building-recertification");
const BSIP_ES = label(es, "broward-bsip");
const CONCRETE = label(en, "reinforced-concrete-design");

// A blob the token route could have produced: our store (the id comes from
// the write token stubbed below), public access, under contact/.
const NOTICE = {
  url: "https://teststore.public.blob.vercel-storage.com/contact/batch-1/notice-a1b2.jpg",
  name: "notice.jpg",
  size: 482_113,
  type: "image/jpeg",
};

const BASE = {
  name: "Ana Rivera",
  email: "ana@example.com",
  phone: null,
  company: null,
  location: "100 Example Ave, Hialeah",
  service: RECERT,
  message: "",
  lang: "en",
  files: [NOTICE],
};

let caller = 0;
function post(body: Record<string, unknown>) {
  // A new address per request: the route allows five per address.
  caller += 1;
  return POST(
    new Request("https://ttcivilstructural.com/api/contact", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": `203.0.113.${caller}`,
      },
      body: JSON.stringify(body),
    })
  );
}

const office = () => mail.sent.find((m) => m.subject.startsWith("Proposal request:"));
const confirmation = () => mail.sent.find((m) => m.to === BASE.email);

beforeEach(() => {
  db.rows.length = 0;
  mail.sent.length = 0;
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_teststore_secret");
});

describe("a county notice with no description", () => {
  it("is accepted for a county program, and the inbox row is not blank", async () => {
    const res = await post(BASE);
    expect(res.status).toBe(201);
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0].message.startsWith("(No description written. See the attachments.)")).toBe(true);
    expect(db.rows[0].message).toContain("Project location: 100 Example Ave, Hialeah");
    expect(db.rows[0].files).toEqual([NOTICE]);
    expect(office()?.html).toContain("(No description written. See the attachments.)");
  });

  it("is accepted under the Spanish label of the other program", async () => {
    const res = await post({ ...BASE, service: BSIP_ES, lang: "es", message: "   " });
    expect(res.status).toBe(201);
    expect(db.rows[0].message).toContain("Language: es");
  });

  it("is refused when nothing is attached", async () => {
    for (const files of [null, [], undefined]) {
      const res = await post({ ...BASE, files });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Message is required" });
    }
    expect(db.rows).toHaveLength(0);
    expect(mail.sent).toHaveLength(0);
  });

  it("is refused for every other service, attachment or not", async () => {
    const res = await post({ ...BASE, service: CONCRETE });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Message is required" });
    expect(db.rows).toHaveLength(0);
  });

  it("does not turn a file from someone else's store into a request", async () => {
    const res = await post({
      ...BASE,
      files: [{ ...NOTICE, url: "https://otherstore.public.blob.vercel-storage.com/contact/x/notice.jpg" }],
    });
    expect(res.status).toBe(400);
    expect(db.rows).toHaveLength(0);
  });

  it("still needs an email address: the reply goes to it", async () => {
    const res = await post({ ...BASE, email: "", phone: "000 000 0000" });
    expect(res.status).toBe(400);
    expect(db.rows).toHaveLength(0);
  });
});

describe("a description, when the visitor writes one", () => {
  it("is stored as written, for any service", async () => {
    for (const service of [RECERT, CONCRETE]) {
      db.rows.length = 0;
      const res = await post({ ...BASE, service, message: "Four-story condo, built in the eighties." });
      expect(res.status).toBe(201);
      expect(db.rows[0].message.startsWith("Four-story condo, built in the eighties.\n\n---\n")).toBe(true);
    }
  });
});

describe("the two notice fields", () => {
  it("ride under the message and reach the office", async () => {
    const res = await post({ ...BASE, noticeDate: " the 3rd of last month ", stories: "4" });
    expect(res.status).toBe(201);
    expect(db.rows[0].message).toContain("\nDate on the notice: the 3rd of last month\n");
    expect(db.rows[0].message).toContain("\nNumber of stories: 4\n");
    expect(office()?.html).toContain("the 3rd of last month");
  });

  it("are left out when empty", async () => {
    await post({ ...BASE, noticeDate: "", stories: null });
    expect(db.rows[0].message).not.toContain("Date on the notice");
    expect(db.rows[0].message).not.toContain("Number of stories");
  });

  it("cannot forge another line of the stored request", async () => {
    const res = await post({ ...BASE, stories: "4\nLanguage: zz" });
    expect(res.status).toBe(201);
    expect(db.rows[0].message).toContain("\nNumber of stories: 4 Language: zz\n");
    expect(db.rows[0].message).not.toContain("\nLanguage: zz");
  });

  it("are refused past the length the inputs allow", async () => {
    const res = await post({ ...BASE, noticeDate: "x".repeat(41) });
    expect(res.status).toBe(400);
  });
});

describe("where the request came from", () => {
  it("is stored and shown to the office", async () => {
    const res = await post({
      ...BASE,
      landing: "/services/building-recertification",
      referrer: "https://www.google.com/",
    });
    expect(res.status).toBe(201);
    expect(db.rows[0].message).toContain("\nArrived on: /services/building-recertification\n");
    expect(db.rows[0].message.endsWith("\nReferred by: https://www.google.com/")).toBe(true);
    expect(office()?.html).toContain("/services/building-recertification");
    expect(office()?.html).toContain("https://www.google.com/");
  });

  it("is never a reason to lose the request", async () => {
    const res = await post({
      ...BASE,
      landing: { not: "a string" },
      referrer: `https://x.example/${"a".repeat(5000)}\nLanguage: zz`,
    });
    expect(res.status).toBe(201);
    expect(db.rows[0].message).not.toContain("Arrived on:");
    const line = db.rows[0].message.split("\n").find((l) => l.startsWith("Referred by: "))!;
    expect(line.length).toBe("Referred by: ".length + 300);
    expect(db.rows[0].message).not.toContain("Language: zz");
  });

  it("is escaped in the office email", async () => {
    await post({ ...BASE, landing: '/"><img src=x onerror=alert(1)>' });
    expect(office()?.html).not.toContain("<img src=x");
  });
});

describe("the confirmation sent to the address the visitor typed", () => {
  it("echoes none of what the visitor or the browser supplied", async () => {
    const res = await post({
      ...BASE,
      message: "Please wire the retainer to account 12345.",
      noticeDate: "the 3rd of last month",
      stories: "17 floors",
      landing: "/landing-marker",
      referrer: "https://referrer-marker.example/",
    });
    expect(res.status).toBe(201);
    expect((await res.json()).confirmed).toBe(true);
    const html = confirmation()!.html;
    for (const s of [
      "wire the retainer",
      "the 3rd of last month",
      "17 floors",
      "/landing-marker",
      "referrer-marker",
      BASE.location,
      BASE.name,
    ]) {
      expect(html).not.toContain(s);
    }
  });
});
