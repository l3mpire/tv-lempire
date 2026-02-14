import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabase } from "@/lib/supabase";
import { getSessionUserId } from "@/lib/auth";

export async function PATCH(request: NextRequest) {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { currentPassword, newPassword } = body;

  if (!currentPassword || typeof currentPassword !== "string") {
    return NextResponse.json({ error: "Current password is required" }, { status: 400 });
  }
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    return NextResponse.json(
      { error: "New password must be at least 6 characters" },
      { status: 400 }
    );
  }

  const supabase = getSupabase();

  const { data: user, error: fetchError } = await supabase
    .from("users")
    .select("id, password_hash")
    .eq("id", userId)
    .single();

  if (fetchError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  const { error: updateError } = await supabase
    .from("users")
    .update({ password_hash: newHash })
    .eq("id", userId);

  if (updateError) {
    return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
