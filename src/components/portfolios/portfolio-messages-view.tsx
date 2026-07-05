"use client";

/**
 * PortfolioMessagesView — thin wrapper around the shared MessagesView.
 *
 * The portfolio detail page renders <MessagesView scope={{ type:
 * "portfolio", portfolioId }} /> directly, so this component is not on
 * the hot path. It previously duplicated the composer + feed, which
 * drifted from the canonical MessagesView (no reply threads). To avoid
 * two sources of truth we now delegate to the shared component, which
 * fully supports the portfolio scope (threads, replies, realtime).
 */

import { MessagesView } from "@/components/views/messages-view";

interface Props {
  portfolioId: string;
}

export function PortfolioMessagesView({ portfolioId }: Props) {
  return <MessagesView scope={{ type: "portfolio", portfolioId }} />;
}
