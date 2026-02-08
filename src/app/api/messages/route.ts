import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabase } from "@/lib/supabase";

const SESSION_COOKIE = "dashboard_session";
const MAX_CONTENT_LENGTH = 500;

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  if (!session || session === "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("messages")
    .select("id, content, created_at, user_id, users(name)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("GET /api/messages error:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }

  const messages = (data ?? []).map((msg: Record<string, unknown>) => ({
    id: msg.id,
    content: msg.content,
    userId: msg.user_id,
    userName: (msg.users as { name: string } | null)?.name ?? "Unknown",
    createdAt: msg.created_at,
  }));

  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionValue || sessionValue === "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = sessionValue;

  let body: { content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const content = body.content?.trim();
  if (!content) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { error: `Content must be ${MAX_CONTENT_LENGTH} characters or less` },
      { status: 400 }
    );
  }

  const supabase = getSupabase();

  // Verify user exists
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, name")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: msg, error: insertError } = await supabase
    .from("messages")
    .insert({ user_id: userId, content })
    .select("id, content, created_at")
    .single();

  if (insertError || !msg) {
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }

  return NextResponse.json({
    message: {
      id: msg.id,
      content: msg.content,
      userId: userId,
      userName: user.name,
      createdAt: msg.created_at,
    },
  });
}

export async function DELETE(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionValue || sessionValue === "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = sessionValue;

  let body: { messageId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messageId = body.messageId;
  if (!messageId) {
    return NextResponse.json({ error: "messageId is required" }, { status: 400 });
  }

  const supabase = getSupabase();

  // Fetch the message to verify ownership
  const { data: msg, error: fetchError } = await supabase
    .from("messages")
    .select("id, user_id")
    .eq("id", messageId)
    .single();

  if (fetchError || !msg) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  if (msg.user_id !== userId) {
    // Check if user is admin
    const { data: user } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", userId)
      .single();

    if (!user?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { error: deleteError } = await supabase
    .from("messages")
    .delete()
    .eq("id", messageId);

  if (deleteError) {
    console.error("DELETE /api/messages error:", deleteError);
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
  }

  return NextResponse.json({ deleted: messageId });
}
