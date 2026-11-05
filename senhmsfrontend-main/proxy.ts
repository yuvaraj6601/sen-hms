import { NextRequest, NextResponse } from "next/server";

// Protect all dashboard routes server-side by checking the httpOnly JWT cookie.
// Runs on Node.js runtime (Edge is not supported in Next.js 16 proxy).
export function proxy(req: NextRequest) {
  const token = req.cookies.get("hms_token")?.value;
  const { pathname } = req.nextUrl;

  if (!token) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/";
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/masters/:path*",
    "/patients/:path*",
    "/admissions/:path*",
    "/op-visits/:path*",
    "/lab/:path*",
    "/appointments/:path*",
    "/bills/:path*",
    "/insurance/:path*",
    "/expenses/:path*",
    "/contacts/:path*",
    "/reports/:path*",
    "/daily-summary/:path*",
    "/settings/:path*",
  ],
};
