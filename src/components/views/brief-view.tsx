"use client";

/**
 * BriefView — "Brief" tab inside a project detail page.
 *
 * Asana parity: each project gets one long-form doc that pins
 * scope, objectives, deliverables, stakeholders, and key dates so
 * the PM doesn't have to dig through the description field every
 * time. Backed by the `ProjectBrief` Prisma model (1:1 with
 * Project). Added during QC Fase 2 P2 (May 23 2026).
 *
 * Edit semantics:
 * - Single editable textarea (rich-text editor) — autosave on blur
 *   so users never lose work.
 * - Shows "Last edited by <name> · 2h ago" footer once a brief
 *   exists. Empty state shows a Markdown-style scaffold (Objective,
 *   Stakeholders, Deliverables, Schedule, Risks) so first-time
 *   editors aren't faced with a blank page.
 */

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RelativeTime } from "@/components/ui/relative-time";
import { Loader2, FileText } from "lucide-react";

interface Brief {
  id: string;
  content: string;
  updatedAt: string;
  lastEditedBy: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
}

const SCAFFOLD = `<h2>Objective</h2><p></p><h2>Stakeholders</h2><p></p><h2>Deliverables</h2><p></p><h2>Schedule</h2><p></p><h2>Risks</h2><p></p>`;

export function BriefView({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [content, setContent] = useState("");
  // Use a ref so the blur handler reads the latest value without
  // re-binding on every keystroke.
  const contentRef = useRef("");
  contentRef.current = content;
  // Track the last server-acknowledged content so blur doesn't
  // fire a save when nothing changed.
  const lastSavedRef = useRef("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/projects/${projectId}/brief`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Brief | null) => {
        if (cancelled) return;
        if (data) {
          setBrief(data);
          setContent(data.content);
          lastSavedRef.current = data.content;
        } else {
          setBrief(null);
          setContent("");
          lastSavedRef.current = "";
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBrief(null);
          setContent("");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function save() {
    const text = contentRef.current;
    if (text === lastSavedRef.current) return; // no-op
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/brief`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = (await res.json()) as Brief;
      setBrief(updated);
      lastSavedRef.current = text;
    } catch {
      toast.error("Couldn't save brief — your changes are still in the editor");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  const isEmpty = !brief && !content;

  return (
    <div className="flex-1 overflow-auto bg-white">
      <div className="max-w-3xl mx-auto px-6 md:px-8 py-8">
        {/* Page heading + last-edited footer */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-500" />
            <h1 className="text-lg font-semibold text-gray-900">
              Project brief
            </h1>
          </div>
          {saving && (
            <div className="flex items-center gap-1.5 text-[12px] text-gray-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving…
            </div>
          )}
        </div>

        {/* Editor — single source of truth. Scaffold appears as the
            initial content for first-time briefs so the page isn't
            empty. The blur handler triggers save. */}
        <div className="rounded-lg border border-gray-200">
          <RichTextEditor
            key={brief?.id ?? "new-brief"}
            initialContent={content || (isEmpty ? SCAFFOLD : "")}
            placeholder="Capture project objectives, stakeholders, deliverables, schedule, and risks…"
            onChange={setContent}
            onBlur={save}
            minHeight="280px"
            maxHeight="none"
            showInsertMenu={true}
            showToolbar={true}
          />
        </div>

        {/* Footer — last edited attribution. Hidden when the brief
            has never been saved. */}
        {brief?.lastEditedBy && (
          <div className="flex items-center gap-2 mt-3 text-[12px] text-gray-500">
            <Avatar className="h-5 w-5">
              {brief.lastEditedBy.image && (
                <AvatarImage
                  src={brief.lastEditedBy.image}
                  alt={brief.lastEditedBy.name ?? ""}
                />
              )}
              <AvatarFallback className="text-[9px] bg-gray-100 text-gray-700">
                {(brief.lastEditedBy.name ?? "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span>
              Last edited by{" "}
              <span className="text-gray-700 font-medium">
                {brief.lastEditedBy.name ?? "Unknown"}
              </span>
              {" · "}
              <RelativeTime date={brief.updatedAt} short />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
