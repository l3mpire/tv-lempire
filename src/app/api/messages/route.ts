import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSessionUserId } from "@/lib/auth";
import { postToSlack } from "@/lib/slack";
const MAX_CONTENT_LENGTH = 500;

export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10) || 50, 1), 50);
  const before = searchParams.get("before");
  const breaking = searchParams.get("breaking");

  const supabase = getSupabase();

  let query = supabase
    .from("messages")
    .select("id, content, created_at, user_id, is_breaking_news, users(name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (breaking === "true") {
    query = query.eq("is_breaking_news", true);
  } else if (breaking === "false") {
    query = query.eq("is_breaking_news", false);
  }

  if (before) {
    query = query.lt("created_at", before);
  }

  const { data, error } = await query;

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
    isBreakingNews: !!msg.is_breaking_news,
  }));

  return NextResponse.json({ messages, hasMore: (data ?? []).length === limit });
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { content?: string; isBreakingNews?: boolean };
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
    .select("id, name, is_admin")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only admins can send breaking news
  const isBreakingNews = !!(body.isBreakingNews && user.is_admin);

  const { data: msg, error: insertError } = await supabase
    .from("messages")
    .insert({ user_id: userId, content, is_breaking_news: isBreakingNews })
    .select("id, content, created_at, is_breaking_news")
    .single();

  if (insertError || !msg) {
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }

  // Fire-and-forget: forward to Slack
  postToSlack(user.name, content, isBreakingNews).catch(console.error);

  return NextResponse.json({
    message: {
      id: msg.id,
      content: msg.content,
      userId: userId,
      userName: user.name,
      createdAt: msg.created_at,
      isBreakingNews: !!msg.is_breaking_news,
    },
  });
}

export async function DELETE(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
