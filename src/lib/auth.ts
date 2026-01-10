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
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log("[Auth] Missing email or password");
          throw new Error("Email and password are required");
        }

        // Normalize email: trim whitespace and convert to lowercase
        const normalizedEmail = credentials.email.trim().toLowerCase();
        console.log("[Auth] Attempting login for:", normalizedEmail);

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });

        if (!user) {
          console.log("[Auth] User not found for email:", normalizedEmail);
          throw new Error("Invalid credentials");
        }

        if (!user.password) {
          console.log("[Auth] User has no password (OAuth account):", normalizedEmail);
          throw new Error("Invalid credentials");
        }

        console.log("[Auth] User found, comparing password...");
        const isPasswordValid = await compare(credentials.password, user.password);
        console.log("[Auth] Password valid:", isPasswordValid);

        if (!isPasswordValid) {
          console.log("[Auth] Invalid password for user:", normalizedEmail);
          throw new Error("Invalid credentials");
        }

        console.log("[Auth] Login successful for:", normalizedEmail);
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
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },
};
