import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import prisma from "./prisma";
import { getPrimaryWorkspaceRole, pickPrimaryWorkspaceRole } from "./auth-guards";
import { clientIp, isRateLimited, rateLimit, refundRateLimit } from "./rate-limit";

/* Messages authorize() throws that the login page shows verbatim (it matches
   them by prefix — keep the two in step). Any other failure is reported there
   as a generic "Invalid email or password". */
const LOGIN_RATE_LIMITED_MESSAGE =
  "Too many attempts. Please wait a few minutes and try again.";
const LOGIN_UNVERIFIED_MESSAGE =
  "Please verify your email before signing in. Check your inbox for the verification link.";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// bcrypt hash (cost 12, same as real passwords) of a throwaway string. It is
// only ever compared against so that a login for an unknown or password-less
// address costs as much as one for a real account; a match is still refused.
const TIMING_EQUALIZER_HASH =
  "$2b$12$UR0/dQMh3rSwW0vVpST3UOP.gor8wTS7WubuJTdp4mZEa7d7cgaGe";

/* The avatar read by the jwt callback on each request, handed to the session
   callback of the SAME request. Keyed by the token object (NextAuth passes the
   one it got back from the jwt callback straight into the session callback),
   so it is never encoded into the cookie and never outlives the request. */
const avatarForToken = new WeakMap<object, string | null>();

/* The jwt callback runs on every getServerSession, i.e. every API call, and
   the avatar can be a data URL of hundreds of KB. Keep it per instance, keyed
   by the user's updatedAt (bumped by every profile write, avatar included), so
   each request reads only that timestamp and the image is fetched again only
   after it may have changed. */
const AVATAR_CACHE_MAX = 500;
const avatarCache = new Map<string, { updatedAt: number; image: string | null }>();

async function avatarFor(userId: string, updatedAt: Date): Promise<string | null> {
  const stamp = updatedAt.getTime();
  const cached = avatarCache.get(userId);
  if (cached && cached.updatedAt === stamp) return cached.image;
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { image: true },
  });
  const image = row?.image ?? null;
  avatarCache.delete(userId);
  if (avatarCache.size >= AVATAR_CACHE_MAX) {
    const oldest = avatarCache.keys().next().value;
    if (oldest !== undefined) avatarCache.delete(oldest);
  }
  avatarCache.set(userId, { updatedAt: stamp, image });
  return image;
}

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
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        // Normalize email: trim whitespace and convert to lowercase
        const normalizedEmail = credentials.email.trim().toLowerCase();

        /* Throttle password GUESSING — audit AUTH-02. Only failed attempts are
           counted (a correct password never burns the budget), and the tight
           bucket is keyed by email + IP, so a stranger hammering a known
           address from their own machine cannot lock the real owner out. The
           looser per-email and per-IP buckets still cap a distributed attack
           on one account and a spray across many. The store is per instance
           (see rate-limit.ts), so these slow an attacker rather than stop one. */
        const ip = clientIp((req?.headers ?? {}) as Record<string, unknown>);
        const loginBuckets: Array<[string, number]> = [
          [`login:${normalizedEmail}:${ip}`, 8],
          [`login:${normalizedEmail}`, 30],
          [`login-ip:${ip}`, 50],
        ];
        if (loginBuckets.some(([key, limit]) => isRateLimited(key, limit).limited)) {
          throw new Error(LOGIN_RATE_LIMITED_MESSAGE);
        }
        // Reserve the attempt before the first await, and give it back once
        // the password proves right. Counting only after the bcrypt compare
        // let a parallel burst all pass the check above before any failure
        // was recorded.
        for (const [key, limit] of loginBuckets) {
          rateLimit(key, limit, LOGIN_WINDOW_MS);
        }
        const refundAttempt = () => {
          for (const [key] of loginBuckets) refundRateLimit(key);
        };

        // Use case-insensitive search in case email was stored differently
        const user = await prisma.user.findFirst({
          where: {
            email: {
              equals: normalizedEmail,
              mode: 'insensitive'
            }
          },
        });

        /* Always run one bcrypt compare, even when there is no account or no
           password to check against. Returning early made an unknown address
           answer ~250 ms faster than a real one, which told anyone timing the
           login form which staff emails have accounts. */
        const isPasswordValid = await compare(
          credentials.password,
          user?.password ?? TIMING_EQUALIZER_HASH
        );

        if (!user || !user.password || !isPasswordValid) {
          throw new Error("Invalid credentials");
        }
        refundAttempt();

        // Require a verified email for password logins. Without this the
        // verification flow is cosmetic — anyone could register with an
        // address they don't control and log in immediately (account
        // squatting) — audit AUTH-01. Existing accounts were grandfathered
        // (backfilled to verified) so only new signups must verify.
        if (!user.emailVerified) {
          throw new Error(LOGIN_UNVERIFIED_MESSAGE);
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          // Never put the avatar in the token: it is an inline data URL of up
          // to 300 KB, and the JWT is a cookie sent with every request. The
          // session callback serves it from the database instead.
          image: null,
        };
      },
    }),
  ],
  callbacks: {
    /* The `signIn` callback is gone with Google. All it did was auto-verify the
       email of a user arriving through the OAuth provider, on the reasoning
       that Google had already proved the address. With credentials as the only
       provider that shortcut has no caller, and returning true unconditionally
       is exactly what NextAuth does by default. Email verification happens
       when the emailed token is redeemed (/onboarding, invite accept, reset). */
    async session({ session, token }) {
      /* A token flagged invalid (password changed after it was issued) must
         resolve to NO session. It used to return the session with the id and
         email blanked, which getServerSession still reports as signed in: the
         dashboard shell rendered with every API answering 401, and the (auth)
         pages bounced /login straight back to /home. An empty object is what
         NextAuth itself returns for "no session" — getServerSession and
         useSession() both treat it as signed out — audit AUTH-03. */
      if (token.invalid) {
        return {} as typeof session;
      }
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role ?? null;
        // Name and avatar are re-read from the database by the jwt callback on
        // every request, so a Settings > Profile edit shows up without a
        // fresh sign-in. The avatar never rides in the cookie (see above).
        session.user.name = token.name ?? null;
        session.user.image = avatarForToken.get(token) ?? null;
      }
      return session;
    },
    async jwt({ token, user }) {
      // Older tokens carried the avatar data URL; drop it so the cookie
      // shrinks back on the next re-encode.
      delete token.picture;

      // Fresh sign-in: establish identity + role. No invalidation check
      // needed because the token is being minted right now.
      if (user) {
        token.id = user.id;
        token.role = await getPrimaryWorkspaceRole(user.id);
        return token;
      }

      // Already evicted: stays signed out, no need to ask the database again.
      if (token.invalid) return token;

      if (!token.id) return token;

      // Existing token. One query does double duty: the passwordChangedAt
      // invalidation check AND the workspace memberships used to refresh the
      // role, so refreshing the role every request costs no extra round trip.
      const dbUser = await prisma.user.findUnique({
        where: { id: token.id },
        select: {
          name: true,
          updatedAt: true,
          passwordChangedAt: true,
          workspaceMembers: {
            select: {
              role: true,
              workspaceId: true,
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

      if (dbUser) {
        token.name = dbUser.name;
        avatarForToken.set(token, await avatarFor(token.id, dbUser.updatedAt));
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
