import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabase } from "@/lib/supabase";

const SESSION_COOKIE = "dashboard_session";

async function requireAdmin() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const supabase = getSupabase();
  const { data: user } = await supabase
    .from("users")
    .select("id, is_admin")
    .eq("id", sessionId)
    .single();

  return user?.is_admin ? user : null;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabase();
  const { data: users, error } = await supabase
    .from("users")
    .select("id, name, email, is_admin, verified, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  return NextResponse.json({ users });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { userId, isAdmin, verified } = body;

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};

  if (typeof isAdmin === "boolean") {
    if (userId === admin.id && !isAdmin) {
      return NextResponse.json({ error: "Cannot remove your own admin role" }, { status: 400 });
    }
    update.is_admin = isAdmin;
  }

  if (typeof verified === "boolean") {
    update.verified = verified;
    if (verified) update.verification_token = null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from("users")
    .update(update)
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await request.json();

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  if (userId === admin.id) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }

  const supabase = getSupabase();

  // Delete user's messages first
  await supabase.from("messages").delete().eq("user_id", userId);

  // Delete user
  const { error } = await supabase.from("users").delete().eq("id", userId);

  if (error) {
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
