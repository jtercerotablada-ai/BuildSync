"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, XCircle } from "lucide-react";

/* Old verification links land here. The token is the same email-verify token
   /onboarding redeems (setting the password and verifying the address in one
   step), so forward it there untouched. This page used to redeem it on its own,
   which burned the token and left the account with no password. */
function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  useEffect(() => {
    if (token) {
      router.replace(`/onboarding?token=${encodeURIComponent(token)}`);
    }
  }, [token, router]);

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ttc/img/logo-square.png" alt="TERCERO TABLADA CIVIL AND STRUCTURAL ENGINEERING INC." className="w-20 h-20 object-contain" />
        </div>
        <CardDescription className="text-center">
          Email verification
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 py-8">
        {token ? (
          <>
            <Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground">Opening account setup...</p>
          </>
        ) : (
          <>
            <XCircle className="h-12 w-12 text-red-500" />
            <div className="text-center">
              <p className="font-semibold text-lg">Verification failed</p>
              <p className="text-sm text-muted-foreground mt-1">
                This link is missing its verification code. Open the link from your email.
              </p>
            </div>
          </>
        )}
      </CardContent>
      {!token && (
        <CardFooter className="flex flex-col gap-2">
          <Button variant="outline" asChild className="w-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </CardFooter>
      )}
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
