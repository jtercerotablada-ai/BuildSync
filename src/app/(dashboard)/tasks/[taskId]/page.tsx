"use client";

/**
 * Full-page task view at /tasks/[taskId].
 *
 * Used in two situations:
 *   1. `window.open(\`/tasks/${id}\`, "_blank")` — the Maximize2 button
 *      inside the task detail panel opens the task in its own tab so
 *      the user can work it side-by-side with another view.
 *   2. Any cross-app surface that needs a stable URL to a task —
 *      home page widgets (Priority Queue, Recent Activity, Upcoming
 *      Milestones, etc.), email digests, comment @-mentions, Inbox
 *      notification links, deep-linked sharing.
 *
 * The page is just a centered wrapper around the shared
 * TaskDetailPanel component so the editor experience is identical
 * to the slide-over you get in a project / my-tasks. Close button
 * sends the user back via router.back() with a /my-tasks fallback
 * for cold-start direct-link visits.
 */

import { useRouter, useParams } from "next/navigation";
import { useEffect } from "react";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";

export default function TaskFullPage() {
  const router = useRouter();
  const params = useParams<{ taskId: string }>();
  const taskId = params?.taskId;

  // The detail panel handles its own loading / error / not-found
  // states by fetching from /api/tasks/:id. If the id is missing
  // entirely there's nothing to render — bounce to /my-tasks.
  useEffect(() => {
    if (!taskId) router.replace("/my-tasks");
  }, [taskId, router]);

  function handleClose() {
    // Prefer the user's actual back stack (a click from /home keeps
    // them on /home after close). If there's no history (cold direct
    // link), fall back to /my-tasks where every task is reachable.
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/my-tasks");
    }
  }

  if (!taskId) return null;

  return (
    <div className="flex-1 flex justify-center bg-[#f6f7f8] overflow-auto">
      <div className="w-full max-w-[760px] bg-white border-x border-[#e8e8e8] min-h-full">
        <TaskDetailPanel
          taskId={taskId}
          onClose={handleClose}
          onUpdate={() => router.refresh()}
        />
      </div>
    </div>
  );
}
