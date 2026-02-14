import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { getSupabase } from "./supabase";

export const SESSION_COOKIE = "dashboard_session";

const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-change-in-production";

export function signSession(userId: string): string {
  const sig = createHmac("sha256", SESSION_SECRET).update(userId).digest("hex");
  return `${userId}.${sig}`;
}

export function verifySession(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const userId = token.substring(0, dot);
  const sig = token.substring(dot + 1);
  const expected = createHmac("sha256", SESSION_SECRET).update(userId).digest("hex");
  if (sig.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return userId;
}

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function requireSession() {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const supabase = getSupabase();
  const { data: user } = await supabase
    .from("users")
    .select("id, name, email, is_admin, verified")
    .eq("id", userId)
    .single();

  return user ?? null;
}

export async function requireAdmin() {
  const user = await requireSession();
  return user?.is_admin ? user : null;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
