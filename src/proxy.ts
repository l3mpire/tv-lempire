import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "dashboard_session";

const PUBLIC_PATHS = ["/login", "/signup", "/api/"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Admin routes: also require Basic Auth (on top of session)
  if (pathname.startsWith("/admin")) {
    return handleAdminAuth(request);
  }

  // All other routes: require session cookie with valid UUID
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (!session || !UUID_RE.test(session)) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
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

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
