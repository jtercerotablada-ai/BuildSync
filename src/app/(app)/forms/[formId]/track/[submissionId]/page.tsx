import { TrackingPageClient } from "./tracking-client";

/**
 * Public form-submission tracking page.
 *
 * No auth — gated by a signed token in the query string. The
 * actual data fetch + reply UI lives in the client component so
 * we can poll for new comments without a server round-trip.
 *
 * This page renders for external submitters (architects, owners,
 * property managers) who need to follow up on a submission they
 * made without creating a BuildSync account. The link is shared
 * via the receipt email + the post-submit thank-you screen.
 */
export default async function TrackSubmissionPage({
  params,
  searchParams,
}: {
  params: Promise<{ formId: string; submissionId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { formId, submissionId } = await params;
  const { token } = await searchParams;

  return (
    <TrackingPageClient
      formId={formId}
      submissionId={submissionId}
      token={token || ""}
    />
  );
}
