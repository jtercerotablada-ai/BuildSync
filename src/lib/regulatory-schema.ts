import { z } from "zod";
import { startOfTodayUtc } from "@/lib/date-only";
import {
  isValidEmail,
  isValidPhone,
  normalizeJurisdiction,
} from "@/lib/regulatory";

/**
 * Zod fields for the eight regulatory columns on Project, spread into both
 * the create (POST /api/projects) and update (PATCH /api/projects/:id)
 * schemas so the two cannot drift.
 *
 * Every limit carries its own English message: the API returns the first
 * issue's message as the toast text, and zod 4's default wording is not
 * something to show a user.
 *
 * Semantics: omitted = undefined (no change on PATCH); '' or null = null
 * (clear the value).
 */

/** Trimmed text with a max length; '' becomes null. */
export function optionalText(max: number, fieldLabel: string) {
  return z
    .string()
    .trim()
    .max(max, `${fieldLabel} is too long (${max} max)`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();
}

/** Same as optionalText with an extra check that runs on the non-empty value. */
function checkedText(
  max: number,
  fieldLabel: string,
  check: (v: string) => boolean,
  message: string
) {
  return z
    .string()
    .trim()
    .max(max, `${fieldLabel} is too long (${max} max)`)
    .refine((v) => v === "" || check(v), message)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();
}

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar "YYYY-MM-DD", or an ISO instant at exactly 00:00:00.000Z. */
export function isValidDeadlineInput(v: string): boolean {
  const m = DATE_ONLY_RE.exec(v);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    return (
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === mo - 1 &&
      dt.getUTCDate() === d
    );
  }
  // Only ISO-looking strings: Date.parse would otherwise accept "12/15/2026".
  if (!/^\d{4}-\d{2}-\d{2}T/.test(v)) return false;
  const t = Date.parse(v);
  if (Number.isNaN(t)) return false;
  return new Date(t).toISOString().endsWith("T00:00:00.000Z");
}

const deadlineField = z
  .string()
  .refine((v) => v === "" || isValidDeadlineInput(v), "Invalid date")
  .nullable()
  .optional();

export const regulatoryFields = {
  jurisdiction: z
    .string()
    .trim()
    .max(120, "Jurisdiction is too long (120 max)")
    .transform((v) => (v === "" ? null : normalizeJurisdiction(v)))
    .nullable()
    .optional(),
  folioNumber: checkedText(
    32,
    "Folio number",
    (v) => /^[0-9A-Za-z.\- ]*$/.test(v),
    "Folio number can only contain letters, digits, dots, dashes and spaces"
  ),
  permitNumber: optionalText(64, "Permit number"),
  caseNumber: optionalText(64, "Case number"),
  regulatoryDeadline: deadlineField,
  clientContactName: optionalText(120, "Contact name"),
  clientContactEmail: checkedText(
    254,
    "Contact email",
    isValidEmail,
    "Enter a valid email"
  ),
  clientContactPhone: checkedText(
    40,
    "Contact phone",
    isValidPhone,
    "Enter a valid phone number"
  ),
};

/** Parsed deadline input → the value to write. undefined = no change,
 *  ''/null = clear, otherwise UTC midnight of the given day. */
export function toDeadline(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  return startOfTodayUtc(new Date(v));
}
