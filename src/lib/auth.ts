import { cookies } from "next/headers";
import { getSupabase } from "./supabase";

export const SESSION_COOKIE = "dashboard_session";

export async function requireSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const supabase = getSupabase();
  const { data: user } = await supabase
    .from("users")
    .select("id, name, email, is_admin, verified")
    .eq("id", sessionId)
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
