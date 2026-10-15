import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  // Always use ONE web address. Login cookies are per-address, so starting sign-in on one
  // Vercel URL and returning on another causes "State cookie was missing".
  const canon = process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL) : null;
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").toLowerCase();
  if (canon && host && host !== canon.host.toLowerCase() && !/^(localhost|127\.)/.test(host)) {
    const u = req.nextUrl.clone();
    u.protocol = canon.protocol; u.host = canon.host; u.port = canon.port;
    return NextResponse.redirect(u, 308);
  }

  const path = req.nextUrl.pathname;
  if (process.env.DEMO_MODE === "true" || path.startsWith("/api/auth") || path === "/login") return NextResponse.next();
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (token) return NextResponse.next();
  if (path.startsWith("/api/")) return Response.json({ error: "Please sign in." }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?callbackUrl=${encodeURIComponent(path)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
