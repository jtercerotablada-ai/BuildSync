"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa] px-6">
      <div className="w-full max-w-md text-center space-y-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ttc/img/logo-square.png"
          alt="TERCERO TABLADA CIVIL AND STRUCTURAL ENGINEERING INC."
          className="w-16 h-16 object-contain mx-auto"
        />
        <h1 className="text-lg font-semibold text-gray-900">
          Something went wrong
        </h1>
        <p className="text-sm text-muted-foreground">
          This screen failed to load. Try again — if it keeps happening, go back
          home and reopen it from there.
        </p>
        {/* The digest is the only handle on the server-side stack, so surface
            it for anyone reporting the failure. */}
        {error.digest && (
          <p className="text-xs text-muted-foreground/70">
            Reference: {error.digest}
          </p>
        )}
        <div className="flex items-center justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" asChild>
            <Link href="/home">Back to home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
