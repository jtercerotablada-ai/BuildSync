import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import prisma from "./prisma";
import { getPrimaryWorkspaceRole } from "./auth-guards";
import { rateLimit } from "./rate-limit";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    newUser: "/onboarding",
  },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        })]
      : []),
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
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        await prisma.user.updateMany({
          where: { email: user.email, emailVerified: null },
          data: { emailVerified: new Date() },
        });
      }
      return true;
    },
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
    async jwt({ token, user, trigger }) {
      // Fresh sign-in: establish identity + role. No invalidation check
      // needed because the token is being minted right now.
      if (user) {
        token.id = user.id;
        token.role = await getPrimaryWorkspaceRole(user.id);
        return token;
      }

      if (!token.id) return token;

      // Existing token. Flag it invalid if the password was changed/reset
      // after the token was issued — otherwise a stateless JWT survives a
      // password reset for up to its full lifetime, so the reset never
      // actually logs an attacker out (audit AUTH-03).
      const dbUser = await prisma.user.findUnique({
        where: { id: token.id },
        select: { passwordChangedAt: true },
      });
      const iatMs = typeof token.iat === "number" ? token.iat * 1000 : 0;
      if (
        dbUser?.passwordChangedAt &&
        iatMs &&
        dbUser.passwordChangedAt.getTime() > iatMs
      ) {
        token.invalid = true;
        return token;
      }

      // Populate/refresh the workspace role so middleware role gates
      // (CLIENT/WORKER redirects, admin protection in src/proxy.ts) actually
      // fire — before this, token.role was never set, so those gates were
      // dead code (SEC-05).
      if (trigger === "update" || token.role === undefined) {
        token.role = await getPrimaryWorkspaceRole(token.id);
      }
      return token;
    },
  },
};
