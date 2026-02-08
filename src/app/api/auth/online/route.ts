import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export async function POST() {
  const user = await requireSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  await supabase
    .from("users")
    .update({ last_online: new Date().toISOString() })
    .eq("id", user.id);

  return NextResponse.json({ ok: true });
}
