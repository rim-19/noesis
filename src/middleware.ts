import { NextRequest, NextResponse } from "next/server";

// Gives every visitor a private, persistent identity so gardens are never
// shared. An anonymous per-device id lives in an httpOnly cookie; every API
// route scopes its data to this id. When real sign-in (Google, etc.) is added
// later, it simply supplies the same `x-noesis-uid` header and nothing else
// changes — all data is already keyed by user id.

const COOKIE = "noesis_uid";
const TWO_YEARS = 60 * 60 * 24 * 365 * 2;

export function middleware(req: NextRequest) {
  const existing = req.cookies.get(COOKIE)?.value;
  const uid = existing || crypto.randomUUID();

  // Forward the id to route handlers on this same request (no cookie race).
  const headers = new Headers(req.headers);
  headers.set("x-noesis-uid", uid);

  const res = NextResponse.next({ request: { headers } });
  if (!existing) {
    res.cookies.set(COOKIE, uid, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: TWO_YEARS,
    });
  }
  return res;
}

export const config = {
  // Run on pages + API, but not on static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-touch-icon.png|manifest.webmanifest|sw.js|.*\\.png$).*)",
  ],
};
