"use client";

import { useEffect } from "react";

/* Last-resort boundary for a failure in the root layout itself. It replaces
   that layout, so it brings its own <html>/<body> and cannot rely on
   globals.css or the UI kit having loaded: inline styles only. */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafafa",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          color: "#111827",
          padding: "0 24px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ttc/img/logo-square.png"
            alt="TERCERO TABLADA CIVIL AND STRUCTURAL ENGINEERING INC."
            width={64}
            height={64}
            style={{ objectFit: "contain", display: "block", margin: "0 auto 16px" }}
          />
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 16px" }}>
            The app failed to load. Reload the page — if it keeps happening,
            try again in a few minutes.
          </p>
          {error.digest && (
            <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 16px" }}>
              Reference: {error.digest}
            </p>
          )}
          {/* A full reload, not reset(): the root layout is what failed, so
              re-rendering the same tree client-side would fail again. */}
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: "#111827",
              color: "#fff",
              border: 0,
              borderRadius: 6,
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
