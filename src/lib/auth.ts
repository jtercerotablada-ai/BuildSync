import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import prisma from "./prisma";

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
      if (token && session.user) {
        session.user.id = token.id as string;
        // Propagate the workspace role onto the session so client
        // components that read it (sidebar, role-gated UI) don't have
        // to re-fetch from /api/auth or DB on every render.
        (session.user as { role?: string }).role = token.role as
          | string
          | undefined;
      }
      return session;
    },
    async jwt({ token, user, trigger }) {
      // On sign-in (`user` populated) OR when explicitly refreshed
      // via `update()`, look up the user's primary workspace role and
      // stamp it on the token. proxy.ts reads `token.role` for all
      // role-based redirects (/client, /portal, /home) — without this
      // the role-based gating is broken because `token.role` was
      // never being set. Fixed during QC Fase 1 on May 22 2026 (bug
      // CL-3).
      if (user) {
        token.id = user.id;
      }
      if (user || trigger === "update" || !token.role) {
        const userId = (token.id as string | undefined) ?? user?.id;
        if (userId) {
          // Pick the first workspace membership — multi-workspace
          // role resolution can layer on top later (e.g. by reading
          // the active workspace id from token.workspaceId). For now
          // the first row matches the existing access-control logic
          // throughout the app (see canAccessSection).
          const member = await prisma.workspaceMember.findFirst({
            where: { userId },
            orderBy: { joinedAt: "asc" },
            select: { role: true, workspaceId: true },
          });
          if (member) {
            token.role = member.role;
            token.workspaceId = member.workspaceId;
          }
        }
      }
      return token;
    },
  },
};
