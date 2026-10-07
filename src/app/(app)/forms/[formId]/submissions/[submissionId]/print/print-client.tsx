"use client";

import { useEffect } from "react";

/**
 * Wraps the server-rendered print view with the print stylesheet
 * and auto-fires the browser's print dialog on mount so the user
 * can "Save as PDF" instantly. Provides a manual Print button as
 * a fallback when the auto-trigger is blocked.
 */
export function PrintSubmissionClient({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Wait one paint so the layout is stable before the OS prompt.
    const t = setTimeout(() => {
      window.print();
    }, 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <style jsx global>{`
        :root {
          color-scheme: light;
        }
        html,
        body {
          background: #ffffff !important;
          color: #111 !important;
          margin: 0;
          padding: 0;
          font-family:
            ui-sans-serif,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          font-size: 12pt;
          line-height: 1.5;
        }
        .print-root {
          max-width: 7.5in;
          margin: 0.5in auto;
          padding: 0 0.5in;
        }
        .print-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1in;
          padding-bottom: 14pt;
          margin-bottom: 18pt;
          border-bottom: 1pt solid #000;
        }
        .print-title {
          font-size: 18pt;
          font-weight: 700;
          margin: 0 0 4pt;
        }
        .print-meta {
          font-size: 9pt;
          color: #555;
          margin: 0 0 2pt;
        }
        .print-meta-right {
          text-align: right;
        }
        .print-mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 8pt;
          color: #888;
        }
        .print-body {
          display: flex;
          flex-direction: column;
          gap: 12pt;
        }
        .print-row {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .print-label {
          font-size: 8pt;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #888;
          margin: 0 0 2pt;
          font-weight: 600;
        }
        .print-value {
          font-size: 11pt;
          color: #111;
          margin: 0;
          white-space: pre-wrap;
        }
        .print-empty {
          color: #aaa;
          font-style: italic;
        }
        .print-attachments {
          margin: 0;
          padding-left: 14pt;
          list-style: disc;
          color: #111;
        }
        .print-attachments a {
          color: #1a1a1a;
          text-decoration: underline;
          word-break: break-all;
        }
        .print-size {
          color: #888;
          font-size: 9pt;
        }
        .print-footer {
          margin-top: 28pt;
          padding-top: 10pt;
          border-top: 1pt solid #ddd;
          display: flex;
          justify-content: space-between;
          font-size: 8pt;
          color: #888;
        }
        .print-toolbar {
          position: fixed;
          top: 16px;
          right: 16px;
          display: flex;
          gap: 8px;
          z-index: 50;
        }
        .print-toolbar button {
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 600;
          border-radius: 6px;
          border: 1pt solid #000;
          background: #000;
          color: #fff;
          cursor: pointer;
        }
        .print-toolbar .secondary {
          background: #fff;
          color: #000;
        }
        @media print {
          .print-toolbar {
            display: none !important;
          }
          .print-root {
            margin: 0 auto;
          }
        }
      `}</style>

      {/* Floating toolbar — hidden when printing. Lets the user
          re-trigger the dialog if they dismissed it, or close the
          tab when they're done. */}
      <div className="print-toolbar">
        <button onClick={() => window.print()}>Print / Save as PDF</button>
        <button className="secondary" onClick={() => window.close()}>
          Close
        </button>
      </div>

      {children}
    </>
  );
}
