import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  if (process.env.DEMO_MODE === "true") return NextResponse.next();
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (token) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) return Response.json({ error: "Please sign in." }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?callbackUrl=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)"] };
