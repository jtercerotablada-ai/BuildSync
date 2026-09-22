"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { uploadDirect } from "@/lib/direct-upload";
import { apiJson, errorMessage } from "./deliverable-api";
import type { DeliverableFileJSON } from "./types";

/**
 * Upload files onto a deliverable: straight from the browser to the blob
 * store (uploadDirect → /api/blob/upload, so a drawing set over the ~4.5MB
 * function body cap works), then a small JSON POST records the row, which
 * re-verifies the blob server-side (verifyUploadedBlob) and deletes it if
 * refused.
 *
 * Files go one at a time, so the progress line names one file and one
 * percentage; each result is its own toast. `onDone` runs once after the
 * batch, whatever succeeded — the caller refetches.
 */
export function useDeliverableUpload(
  deliverableId: string,
  onDone: () => void
) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [currentName, setCurrentName] = useState<string | null>(null);
  const busyRef = useRef(false);

  const upload = useCallback(
    async (list: FileList | File[] | null, revisionId: string | null) => {
      const files = list ? Array.from(list) : [];
      if (files.length === 0 || busyRef.current) return;
      busyRef.current = true;
      setUploading(true);
      try {
        for (const file of files) {
          setCurrentName(file.name);
          setProgress(0);
          try {
            const { url } = await uploadDirect(
              file,
              { kind: "deliverable-file", deliverableId },
              (p) => setProgress(Math.round(p))
            );
            await apiJson<DeliverableFileJSON>(
              `/api/deliverables/${deliverableId}/files`,
              {
                method: "POST",
                json: { blobUrl: url, name: file.name, revisionId },
              },
              "Upload failed"
            );
            toast.success(`${file.name} uploaded`);
          } catch (err) {
            toast.error(`${file.name}: ${errorMessage(err, "upload failed")}`);
          }
        }
      } finally {
        busyRef.current = false;
        setUploading(false);
        setProgress(null);
        setCurrentName(null);
        // Refetch even when every file failed: a 409 ("This revision is
        // locked") means the revision changed under us, and the sheet must
        // stop offering the dropzone.
        onDone();
      }
    },
    [deliverableId, onDone]
  );

  return { upload, uploading, progress, currentName };
}
