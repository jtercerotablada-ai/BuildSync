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
  "/resources",
];

// TTC public pages (marketing / informational) - no auth required
const publicExactRoutes = [
  "/",
  "/projects",
  "/services",
  "/about",
  "/contact",
];

function isPublicRoute(pathname: string): boolean {
  if (publicExactRoutes.includes(pathname)) {
    return true;
  }
  return publicPrefixes.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
