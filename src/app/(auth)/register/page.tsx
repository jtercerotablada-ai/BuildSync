import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";

/* Self-service sign-up is closed (see /api/auth/register): BuildSync is the
   firm's staff-only tool and every account comes from a workspace invitation.
   The route stays so old links land on an explanation instead of a 404. */
export default function RegisterPage() {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ttc/img/logo-square.png" alt="TERCERO TABLADA CIVIL AND STRUCTURAL ENGINEERING INC." className="w-20 h-20 object-contain" />
        </div>
        <CardDescription className="text-center">
          Accounts are by invitation only
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>
          BuildSync is the internal workspace of Tercero Tablada Civil &amp;
          Structural Engineering. To get an account, ask a workspace admin to
          send you an invitation.
        </p>
        <p>
          Then open the link in the invitation email: it lets you choose your
          password and joins you to the right workspace in one step.
        </p>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button asChild className="w-full">
          <Link href="/login">Go to sign in</Link>
        </Button>
        <p className="text-xs text-center text-muted-foreground w-full">
          Already have an account but forgot the password?{" "}
          <Link href="/forgot-password" className="text-primary hover:underline">
            Reset it
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
