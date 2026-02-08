import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { SESSION_COOKIE } from "@/lib/auth";

// /api/ routes skip middleware redirect — they handle auth themselves via
// requireAdmin()/requireSession() and return JSON 401/403 instead of redirects.
const PUBLIC_PATHS = ["/login", "/signup", "/api/", "/pending", "/reset-password"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // All other routes: require session cookie with valid UUID
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (!session || !UUID_RE.test(session)) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Fetch user from DB (verified + admin check)
  const supabase = getSupabase();
  const { data: user } = await supabase
    .from("users")
    .select("verified, is_admin")
    .eq("id", session)
    .single();

  // Unverified users → /pending
  if (!user?.verified) {
    return NextResponse.redirect(new URL("/pending", request.url));
  }

  // Admin routes: require is_admin flag
  if (pathname.startsWith("/admin") && !user.is_admin) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
