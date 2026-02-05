import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "dashboard_session";
const SESSION_VALUE = "authenticated";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin routes: Basic Auth (existing behavior)
  if (pathname.startsWith("/admin")) {
    return handleAdminAuth(request);
  }

  // Dashboard root: session cookie
  if (pathname === "/") {
    return handleDashboardAuth(request);
  }

  return NextResponse.next();
}

function handleAdminAuth(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (authHeader) {
    const [scheme, encoded] = authHeader.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = atob(encoded);
      const [, password] = decoded.split(":");
      if (password === process.env.ADMIN_PASSWORD) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Admin"',
    },
  });
}

function handleDashboardAuth(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE);

  if (session?.value === SESSION_VALUE) {
    return NextResponse.next();
  }

  // Redirect to login
  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/", "/admin", "/admin/:path*"],
};
