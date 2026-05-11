"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * AI Coach panel — replaces the old "See improvements" toast banner.
 *
 * Calls POST /api/ai/coach which assembles linked projects, KR updates,
 * overdue tasks, children, and recent check-ins into a context block,
 * then asks Claude for risks + interventions + forecast.
 *
 * The response is cached in localStorage keyed by objectiveId so
 * navigation back to the goal shows the prior analysis instantly
 * without re-charging tokens. The "Refresh" button is the explicit
 * re-run.
 */
export function AICoachPanel({ objectiveId }: { objectiveId: string }) {
  const cacheKey = `goals.coach.${objectiveId}`;
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as {
          analysis: string;
          at: string;
        };
        setAnalysis(parsed.analysis);
        setLastRunAt(parsed.at);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectiveId]);

  async function run() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectiveId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const text: string = data.analysis ?? "";
      setAnalysis(text);
      const at = new Date().toISOString();
      setLastRunAt(at);
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ analysis: text, at }));
      } catch {
        // localStorage full or disabled — non-fatal
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Couldn't run AI Coach"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border rounded-xl bg-white mb-6 md:mb-8 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-5 w-5 text-[#c9a84c] flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-black truncate">
              AI Coach
            </p>
            <p className="text-[11px] text-gray-500 truncate">
              {analysis
                ? `Last analysis ${lastRunAt ? formatRelative(lastRunAt) : "earlier"} · grounded in your projects, KRs, and check-ins`
                : "One click for risks, interventions and a forecast — grounded in your real project data"}
            </p>
          </div>
        </div>
        <Button
          variant={analysis ? "outline" : "default"}
          size="sm"
          onClick={run}
          disabled={loading}
          className={cn(
            !analysis && "bg-black hover:bg-gray-900 text-white"
          )}
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              Analyzing…
            </>
          ) : analysis ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
              Refresh
            </>
          ) : (
            "Analyze goal"
          )}
        </Button>
      </div>

      {analysis && (
        <div className="px-4 py-4">
          <MarkdownBlock text={analysis} />
        </div>
      )}
    </div>
  );
}

/**
 * Tiny, dependency-free markdown renderer. Handles only what the AI
 * Coach prompt asks the model to produce: `### Heading`, `**bold**`,
 * `- bullets`, and plain paragraphs. Anything more complex falls back
 * to a `<pre>` line.
 *
 * We intentionally avoid pulling in react-markdown / remark just for
 * a 3-section response — saves ~100kb on the goal page.
 */
function MarkdownBlock({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const elements: React.ReactNode[] = [];
  let buffer: string[] = [];
  let inList = false;

  function flushBuffer() {
    if (buffer.length > 0) {
      elements.push(
        <p
          key={elements.length}
          className="text-sm text-gray-700 leading-relaxed mb-3"
          dangerouslySetInnerHTML={{ __html: renderInline(buffer.join(" ")) }}
        />
      );
      buffer = [];
    }
  }

  function flushList(items: string[]) {
    if (items.length > 0) {
      elements.push(
        <ul
          key={elements.length}
          className="list-disc pl-5 mb-3 space-y-1 text-sm text-gray-700"
        >
          {items.map((item, i) => (
            <li
              key={i}
              dangerouslySetInnerHTML={{ __html: renderInline(item) }}
            />
          ))}
        </ul>
      );
    }
  }

  let listItems: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (inList) {
        flushList(listItems);
        listItems = [];
        inList = false;
      }
      flushBuffer();
      continue;
    }
    if (line.startsWith("### ")) {
      if (inList) {
        flushList(listItems);
        listItems = [];
        inList = false;
      }
      flushBuffer();
      elements.push(
        <h4
          key={elements.length}
          className="text-[11px] font-semibold text-gray-900 uppercase tracking-wider mt-3 mb-2 first:mt-0"
        >
          {line.replace(/^###\s+/, "")}
        </h4>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      if (inList) {
        flushList(listItems);
        listItems = [];
        inList = false;
      }
      flushBuffer();
      elements.push(
        <h3
          key={elements.length}
          className="text-sm font-semibold text-gray-900 mt-3 mb-2 first:mt-0"
        >
          {line.replace(/^##\s+/, "")}
        </h3>
      );
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flushBuffer();
      inList = true;
      listItems.push(line.replace(/^[-*]\s+/, ""));
      continue;
    }
    if (inList) {
      flushList(listItems);
      listItems = [];
      inList = false;
    }
    buffer.push(line);
  }

  if (inList) flushList(listItems);
  flushBuffer();

  return <div>{elements}</div>;
}

function renderInline(text: string): string {
  // Escape any HTML to avoid injection — the model could theoretically
  // emit raw tags. Then re-introduce **bold** as <strong>.
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(
    /\*\*(.+?)\*\*/g,
    "<strong class='text-gray-900 font-semibold'>$1</strong>"
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "earlier";
  const delta = Date.now() - then;
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
