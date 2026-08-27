import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import prisma from "./prisma";
import { getPrimaryWorkspaceRole, pickPrimaryWorkspaceRole } from "./auth-guards";
import { rateLimit } from "./rate-limit";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  session: {
    strategy: "jwt",
    // 30 days, pinned explicitly (this is NextAuth's own default) so the
    // token lifetime is visible rather than an invisible framework default.
    // It bounds how long a stolen token can live; a role change does NOT wait
    // for it — the jwt callback below re-reads the role on every request
    // (BS-05).
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    newUser: "/onboarding",
  },
  /* Email + password is the ONLY way in. Google sign-in was removed on
     2026-08-16: the button had never worked, because the provider was gated on
     GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET and neither was ever set in Vercel.
     That gate is also what makes the removal safe — an inactive provider can
     have created no accounts, so there is no user out there holding a
     password-less Google row who would now be locked out. */
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        // Normalize email: trim whitespace and convert to lowercase
        const normalizedEmail = credentials.email.trim().toLowerCase();

        // Throttle password attempts per email to slow online brute force —
        // audit AUTH-02. (See rate-limit.ts note on serverless memory.)
        const limited = rateLimit(`login:${normalizedEmail}`, 8, 15 * 60 * 1000);
        if (!limited.ok) {
          throw new Error("Too many attempts. Please wait a few minutes and try again.");
        }

        // Use case-insensitive search in case email was stored differently
        const user = await prisma.user.findFirst({
          where: {
            email: {
              equals: normalizedEmail,
              mode: 'insensitive'
            }
          },
        });

        if (!user) {
          throw new Error("Invalid credentials");
        }

        if (!user.password) {
          throw new Error("Invalid credentials");
        }

        const isPasswordValid = await compare(credentials.password, user.password);

        if (!isPasswordValid) {
          throw new Error("Invalid credentials");
        }

        // Require a verified email for password logins. Without this the
        // verification flow is cosmetic — anyone could register with an
        // address they don't control and log in immediately (account
        // squatting) — audit AUTH-01. Existing accounts were grandfathered
        // (backfilled to verified) so only new signups must verify.
        if (!user.emailVerified) {
          throw new Error("Please verify your email before signing in. Check your inbox for the verification link.");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    /* The `signIn` callback is gone with Google. All it did was auto-verify the
       email of a user arriving through the OAuth provider, on the reasoning
       that Google had already proved the address. With credentials as the only
       provider that shortcut has no caller, and returning true unconditionally
       is exactly what NextAuth does by default. Email verification for
       password signups runs through /api/auth/verify-email instead. */
    async session({ session, token }) {
      // A token flagged invalid (password changed after it was issued)
      // resolves to a signed-out session. getCurrentUser() keys off email,
      // so clearing it makes every API route treat the request as
      // unauthenticated — audit AUTH-03.
      if (token.invalid) {
        if (session.user) {
          session.user.id = "";
          session.user.email = null;
        }
        return session;
      }
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role ?? null;
      }
      return session;
    },
    async jwt({ token, user }) {
      // Fresh sign-in: establish identity + role. No invalidation check
      // needed because the token is being minted right now.
      if (user) {
        token.id = user.id;
        token.role = await getPrimaryWorkspaceRole(user.id);
        return token;
      }

      if (!token.id) return token;

      // Existing token. One query does double duty: the passwordChangedAt
      // invalidation check AND the workspace memberships used to refresh the
      // role, so refreshing the role every request costs no extra round trip.
      const dbUser = await prisma.user.findUnique({
        where: { id: token.id },
        select: {
          passwordChangedAt: true,
          workspaceMembers: {
            select: {
              role: true,
              workspace: { select: { _count: { select: { members: true } } } },
            },
            // Matches getPrimaryWorkspaceRole exactly; id is the deterministic
            // tiebreak so equal joinedAt can't flap the per-request role pick.
            orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
          },
        },
      });

      // Flag the token invalid if the password was changed/reset after it was
      // issued — otherwise a stateless JWT survives a password reset for up to
      // its full lifetime, so the reset never actually logs an attacker out
      // (audit AUTH-03).
      const iatMs = typeof token.iat === "number" ? token.iat * 1000 : 0;
      if (
        dbUser?.passwordChangedAt &&
        iatMs &&
        dbUser.passwordChangedAt.getTime() > iatMs
      ) {
        token.invalid = true;
        return token;
      }

      // Refresh the workspace role on EVERY request, not just at sign-in or on
      // an explicit session.update(). The token is a stateless JWT that lives
      // up to maxAge (30 days), so gating the refresh on trigger === "update"
      // meant a role change — demoting a MEMBER to CLIENT/GUEST, or promoting a
      // CLIENT — did not take effect until the user happened to sign out. The
      // middleware role gates (src/proxy.ts) and the /api default-deny read
      // this role, so a stale value kept an offboarded user's access live for
      // up to the full token lifetime (SEC-05 / BS-05). Computed from the query
      // above via the shared heuristic — no extra round trip.
      token.role = pickPrimaryWorkspaceRole(dbUser?.workspaceMembers ?? []);
      return token;
    },
  },
};
