import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireSession } from "@/lib/auth";

export async function GET() {
  const user = await requireSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const { data: users, error } = await supabase
    .from("users")
    .select("name, last_online")
    .eq("verified", true);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  return NextResponse.json({ users: users.map((u) => ({ name: u.name, lastOnline: u.last_online })) });
}
