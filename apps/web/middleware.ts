import { NextResponse, type NextRequest } from "next/server";

const protectedPrefixes = ["/projects", "/dashboard"];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // We check either the real access token, or assume true if dev (to rely on backend rejection)
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const hasSession =
    isDemo ||
    Boolean(request.cookies.get("ff_access_token")?.value) ||
    process.env.NODE_ENV === "development";
  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (isProtected && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && hasSession) {
    return NextResponse.redirect(new URL("/projects", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/projects/:path*", "/dashboard/:path*"]
};
