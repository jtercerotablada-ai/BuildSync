import { describe, expect, it } from "vitest";
import {
  type FormAttachment,
  type FormField,
  coerceSubmittedAnswers,
  csvCell,
  firstEmailAnswer,
  formatAnswerForText,
  neutralizeStoredAnswers,
} from "./form-types";

const f = (id: string, type: FormField["type"], extra: Partial<FormField> = {}): FormField => ({
  id,
  label: id,
  type,
  required: false,
  ...extra,
});

const fields: FormField[] = [
  f("name", "TEXT"),
  f("mail", "EMAIL"),
  f("qty", "NUMBER", { unit: "psf" }),
  f("tags", "MULTI_SELECT", { options: ["a", "b"] }),
  f("file", "ATTACHMENT"),
  f("h", "HEADING"),
];

// Shaped like a forged payload: no mimeType, a foreign url.
const forged = {
  name: "Permit set.pdf",
  url: "https://evil.example/x.exe",
  size: 1,
} as unknown as FormAttachment;

describe("coerceSubmittedAnswers", () => {
  it("keeps well-shaped answers", () => {
    expect(
      coerceSubmittedAnswers(fields, {
        name: "RFI 12",
        mail: "a@b.co",
        qty: 12,
        tags: ["a"],
      })
    ).toEqual({ name: "RFI 12", mail: "a@b.co", qty: "12", tags: ["a"] });
  });

  it("drops forged attachment objects on any field, and every ATTACHMENT answer", () => {
    const out = coerceSubmittedAnswers(fields, {
      name: [forged],
      tags: [forged],
      file: [forged],
      h: "x",
      unknown: "y",
    });
    expect(out).toEqual({});
  });

  it("ignores non-object payloads", () => {
    expect(coerceSubmittedAnswers(fields, null)).toEqual({});
    expect(coerceSubmittedAnswers(fields, ["x"])).toEqual({});
  });
});

describe("neutralizeStoredAnswers", () => {
  const trusted = (u: string) => u.startsWith("https://store.public.blob");
  it("strips untrusted links on ATTACHMENT fields and keeps trusted ones", () => {
    const out = neutralizeStoredAnswers(
      fields,
      {
        file: [
          forged,
          { name: "ok.pdf", url: "https://store.public.blob/ok.pdf", size: 2, mimeType: "application/pdf" },
        ],
      },
      trusted
    );
    expect(out.file).toEqual([
      { name: "Permit set.pdf", url: "", size: 1, mimeType: "" },
      { name: "ok.pdf", url: "https://store.public.blob/ok.pdf", size: 2, mimeType: "application/pdf" },
    ]);
  });

  it("flattens attachment-shaped values on other fields to text", () => {
    const out = neutralizeStoredAnswers(fields, { name: [forged] }, trusted);
    expect(out.name).toBe("Permit set.pdf");
    expect(formatAnswerForText(out.name)).toBe("Permit set.pdf");
  });

  it("passes plain values through", () => {
    expect(neutralizeStoredAnswers(fields, { qty: "3", tags: ["a"] }, trusted)).toEqual({
      qty: "3",
      tags: ["a"],
    });
  });
});

describe("firstEmailAnswer", () => {
  it("reads the EMAIL field, not any string with an @", () => {
    expect(
      firstEmailAnswer(fields, { name: "super @ gate 3", mail: " x@y.co " })
    ).toBe("x@y.co");
    expect(firstEmailAnswer(fields, { name: "a@b.co" })).toBeNull();
  });
});

describe("csvCell", () => {
  it("neutralizes formula prefixes", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell("+A1")).toBe(`"'+A1"`);
    expect(csvCell("-2+A1")).toBe(`"'-2+A1"`);
    expect(csvCell("@SUM(A1)")).toBe(`"'@SUM(A1)"`);
    expect(csvCell("\t=1")).toBe(`"'\t=1"`);
  });
  it("leaves ordinary text alone", () => {
    expect(csvCell("Hello")).toBe(`"Hello"`);
    expect(csvCell("")).toBe(`""`);
    expect(csvCell("-2")).toBe(`"-2"`);
    expect(csvCell("+1.5")).toBe(`"+1.5"`);
  });
});
