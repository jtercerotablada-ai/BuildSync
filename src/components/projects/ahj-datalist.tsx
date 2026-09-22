import { SOUTH_FLORIDA_AHJS } from "@/lib/regulatory";

/**
 * The South Florida authorities having jurisdiction, as a native <datalist>
 * for a Jurisdiction input (`list={id}`). Suggestions only: the field is
 * free text, so any authority ("City of Opa-locka") still saves.
 */
export function AhjDatalist({ id }: { id: string }) {
  return (
    <datalist id={id}>
      {SOUTH_FLORIDA_AHJS.map((ahj) => (
        <option key={ahj} value={ahj} />
      ))}
    </datalist>
  );
}
