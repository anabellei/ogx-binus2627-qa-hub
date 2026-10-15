import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getToken, type JWT } from "next-auth/jwt";
import { cookies, headers } from "next/headers";
import type { NextRequest } from "next/server";
import { ALLOWED_DOMAINS, ALLOWED_EMAILS, DEMO, HttpError } from "./config";

const SCOPES = [
  "openid", "email", "profile",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/spreadsheets",
].join(" ");

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: { params: { scope: SCOPES, access_type: "offline", prompt: "consent" } },
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      if (!ALLOWED_DOMAINS.length) return true;
      const email = (profile?.email ?? "").toLowerCase();
      return ALLOWED_DOMAINS.some((d) => email.endsWith("@" + d));
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token ?? token.refreshToken;
        token.expiresAt = (account.expires_at ?? 0) * 1000;
      }
      return token;
    },
  },
};

/* Refreshed access tokens are cached per server instance (cookie can't be rewritten in route handlers). */
const refreshCache = new Map<string, { token: string; exp: number }>();

async function freshAccessToken(jwt: JWT): Promise<string> {
  const exp = (jwt.expiresAt as number | undefined) ?? 0;
  if (jwt.accessToken && exp > Date.now() + 60_000) return jwt.accessToken as string;
  const rt = jwt.refreshToken as string | undefined;
  if (!rt) throw new HttpError(401, "Session expired. Please sign in again.");
  const hit = refreshCache.get(rt);
  if (hit && hit.exp > Date.now() + 60_000) return hit.token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token", refresh_token: rt,
    }),
  });
  if (!res.ok) throw new HttpError(401, "Session expired. Please sign in again.");
  const j = (await res.json()) as { access_token: string; expires_in: number };
  refreshCache.set(rt, { token: j.access_token, exp: Date.now() + j.expires_in * 1000 });
  return j.access_token;
}

async function readJwt(req?: NextRequest): Promise<JWT | null> {
  const r = req ?? ({ cookies: await cookies(), headers: await headers() } as unknown as NextRequest);
  return getToken({ req: r, secret: process.env.NEXTAUTH_SECRET });
}

export interface Ctx { token: string; user: { name: string; email: string; image?: string } }

export async function getCtx(req?: NextRequest): Promise<Ctx> {
  if (DEMO) return { token: "demo", user: { name: "Demo Staff", email: "demo@example.org" } };
  const jwt = await readJwt(req);
  if (!jwt) throw new HttpError(401, "Please sign in.");
  return {
    token: await freshAccessToken(jwt),
    user: { name: jwt.name ?? "", email: jwt.email ?? "", image: jwt.picture ?? undefined },
  };
}

export async function getUserOnly() {
  if (DEMO) return { name: "Demo Staff", email: "demo@example.org", image: undefined as string | undefined };
  const jwt = await readJwt();
  return jwt ? { name: jwt.name ?? "", email: jwt.email ?? "", image: jwt.picture ?? undefined } : null;
}
