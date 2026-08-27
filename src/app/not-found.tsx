import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa] px-6">
      <div className="w-full max-w-md text-center space-y-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ttc/img/logo-square.png"
          alt="TERCERO TABLADA CIVIL AND STRUCTURAL ENGINEERING INC."
          className="w-16 h-16 object-contain mx-auto"
        />
        <h1 className="text-lg font-semibold text-gray-900">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          This page doesn&apos;t exist, or the item it pointed to was deleted or
          is no longer shared with you.
        </p>
        <Button asChild>
          <Link href="/home">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
