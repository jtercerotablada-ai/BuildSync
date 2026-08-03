/**
 * One-shot "open the team invite dialog" intent, passed across a client
 * navigation.
 *
 * The "Invite teammate" entry points (Home People widget + header menu)
 * don't know which team to invite to, so they route through /teams,
 * which resolves the user's team and forwards to that team's overview —
 * where the invite dialog lives. We can't carry the intent in the URL:
 * reading a `?invite=1` query via `window.location.search` in a mount
 * effect is unreliable during a *soft* navigation (the URL hasn't
 * committed yet when the effect runs), and `useSearchParams` would force
 * a Suspense boundary onto the pages. sessionStorage is read
 * synchronously and is immune to that timing, so it's the simplest
 * reliable signal for this ephemeral, one-shot intent.
 */

const KEY = "bs.teamInviteIntent";

/** Mark that the next team overview we land on should open its invite dialog. */
export function requestTeamInvite(): void {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    /* private mode / storage disabled — invite just won't auto-open */
  }
}

/** True if an invite intent is pending, WITHOUT clearing it. */
export function peekTeamInvite(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Read-and-clear the intent. Returns true if it was set. */
export function consumeTeamInvite(): boolean {
  try {
    const pending = sessionStorage.getItem(KEY) === "1";
    if (pending) sessionStorage.removeItem(KEY);
    return pending;
  } catch {
    return false;
  }
}
