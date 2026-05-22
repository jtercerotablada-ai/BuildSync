import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public routes that don't require authentication
const publicPrefixes = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/api/auth",
  "/api/my-tasks/calendar-feed",
  "/api/contact",
];

// TTC public pages (marketing / informational) - no auth required
const publicExactRoutes = [
  "/",
  "/projects",
  "/services",
  "/about",
  "/contact",
  "/logo-styles",
];

function isPublicRoute(pathname: string): boolean {
  if (publicExactRoutes.includes(pathname)) {
    return true;
  }
  return publicPrefixes.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Maintenance mode — when true, every request from the public web
 * lands on /maintenance. Localhost (`next dev`) is NEVER affected
 * because the trip-wire below only fires on Vercel-hosted environments.
 *
 * To take the site live again, flip MAINTENANCE_MODE to `false` and
 * push. (Alternative: set MAINTENANCE_MODE_OFF=true in Vercel project
 * env vars to override without a code change.)
 */
const MAINTENANCE_MODE = true;

function isMaintenanceActive(): boolean {
  if (!MAINTENANCE_MODE) return false;
  if (process.env.MAINTENANCE_MODE_OFF === "true") return false;
  // NODE_ENV is the ONE flag Next.js owns end-to-end and that `.env.local`
  // cannot poison: `next dev` always exports "development" regardless of
  // what's checked into the repo's env files, and Vercel runs the built
  // image with "production". VERCEL_ENV/VERCEL won't work here because
  // `vercel pull` writes those into .env.local for emulation, which then
  // makes the dev server think it's in prod and redirects every request
  // to /maintenance — Juan hit this on first run.
  return process.env.NODE_ENV === "production";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Maintenance mode (production-only) ──────────────────────────
  // Redirect every non-maintenance, non-asset request to /maintenance.
  if (isMaintenanceActive()) {
    if (
      pathname === "/maintenance" ||
      pathname.startsWith("/_next") ||
      pathname.startsWith("/ttc/") ||
      pathname.startsWith("/api/health") ||
      pathname === "/favicon.ico" ||
      pathname === "/icon.svg" ||
      pathname === "/robots.txt"
    ) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/maintenance", request.url));
  }

  // Skip public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Skip static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check for valid session token
  const token = await getToken({ req: request });

  if (!token) {
    // API routes return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Page routes redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based redirects for authenticated users
  const userRole = (token as Record<string, unknown>).role as string | undefined;

  // CLIENT role users accessing dashboard should be redirected to client portal
  if (userRole === "CLIENT" && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/client", request.url));
  }

  // WORKER role users accessing client portal should be redirected to portal
  if (userRole === "WORKER" && pathname.startsWith("/client")) {
    return NextResponse.redirect(new URL("/portal", request.url));
  }

  // Prevent non-admin/owner users from accessing admin routes
  if (
    pathname.startsWith("/portal") &&
    userRole !== "WORKER" &&
    userRole !== "ADMIN" &&
    userRole !== "OWNER"
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (
    pathname.startsWith("/client") &&
    userRole !== "CLIENT" &&
    userRole !== "ADMIN" &&
    userRole !== "OWNER"
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
