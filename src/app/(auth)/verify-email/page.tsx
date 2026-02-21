"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token provided");
      return;
    }

    async function verify() {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (res.ok) {
          setStatus("success");
          setMessage(data.message || "Email verified successfully!");
        } else {
          setStatus("error");
          setMessage(data.error || "Verification failed");
        }
      } catch {
        setStatus("error");
        setMessage("Something went wrong");
      }
    }

    verify();
  }, [token]);

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-black text-white font-semibold text-base">
            <span>B<span className="text-sm">s</span><span className="text-[10px] ml-[1px]">.</span></span>
          </div>
          <span className="text-2xl font-bold">BuildSync</span>
        </div>
        <CardDescription className="text-center">
          Email verification
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 py-8">
        {status === "loading" && (
          <>
            <Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground">Verifying your email...</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle className="h-12 w-12 text-green-600" />
            <div className="text-center">
              <p className="font-semibold text-lg">{message}</p>
              <p className="text-sm text-muted-foreground mt-1">
                You can now sign in to your account.
              </p>
            </div>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="h-12 w-12 text-red-500" />
            <div className="text-center">
              <p className="font-semibold text-lg">Verification failed</p>
              <p className="text-sm text-muted-foreground mt-1">{message}</p>
            </div>
          </>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        {status === "success" && (
          <Button asChild className="w-full">
            <Link href="/login">Sign in</Link>
          </Button>
        )}
        {status === "error" && (
          <Button variant="outline" asChild className="w-full">
            <Link href="/login">Back to login</Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
