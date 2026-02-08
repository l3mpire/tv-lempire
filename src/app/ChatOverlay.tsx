"use client";

import { useEffect, useState, useRef, useCallback, memo } from "react";
import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import ChatMessage from "./ChatMessage";
import Tooltip from "./Tooltip";
import { useOnlineUsers } from "./presenceStore";

type Message = {
  id: string;
  content: string;
  userId: string;
  userName: string;
  createdAt: string;
  isBreakingNews?: boolean;
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Create browser Supabase client once (module scope, client-side only)
function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;
  return createClient(url, key);
}

export default memo(function ChatOverlay() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [breakingNews, setBreakingNews] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [showUsers, setShowUsers] = useState(true);
  const [verifiedUsers, setVerifiedUsers] = useState<string[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const onlineUsers = useOnlineUsers();
  const openRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const wasOpenRef = useRef(false);

  const isNearBottom = useCallback((el: HTMLElement, threshold = 80) => {
    return el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const fetchVerifiedUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (!res.ok) return;
      const data = await res.json();
      if (data.users) setVerifiedUsers(data.users);
    } catch {
      // Ignore
    }
  }, []);

  // Fetch current user + verified users
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) return;
        const data = await res.json();
        if (data.user?.id) {
          setCurrentUserId(data.user.id);
          setIsAdmin(!!data.user.isAdmin);
        }
      } catch {
        // Not logged in
      }
    };
    fetchUser();
    fetchVerifiedUsers();
  }, [fetchVerifiedUsers]);

  // Initial fetch + Realtime subscription
  useEffect(() => {
    // 1. Load initial messages via API
    const fetchMessages = async () => {
      try {
        const res = await fetch("/api/messages?limit=10");
        if (!res.ok) return;
        const data = await res.json();
        if (data.messages) {
          setMessages(data.messages.reverse());
          setHasMore(!!data.hasMore);
        }
      } catch (e) {
        console.error("Failed to fetch messages:", e);
      }
    };
    fetchMessages();

    // 2. Subscribe to broadcast channel
    const supabase = createBrowserSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel("chat")
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        const msg = payload as Message;
        if (!msg?.id) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          if (!openRef.current) setHasUnread(true);
          return [...prev, msg];
        });
      })
      .on("broadcast", { event: "delete_message" }, ({ payload }) => {
        const { id } = payload as { id: string };
        if (!id) return;
        setMessages((prev) => prev.filter((m) => m.id !== id));
      })
      .on("broadcast", { event: "users_changed" }, () => {
        fetchVerifiedUsers();
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [fetchVerifiedUsers]);

  // Re-fetch verified users when an online user is unknown (e.g. newly verified)
  const lastPresenceFetchRef = useRef(0);
  useEffect(() => {
    if (onlineUsers.size === 0 || verifiedUsers.length === 0) return;
    const hasUnknown = Array.from(onlineUsers).some(
      (name) => !verifiedUsers.includes(name)
    );
    if (!hasUnknown) return;
    // Throttle: at most once every 10s to avoid infinite re-fetch loops
    const now = Date.now();
    if (now - lastPresenceFetchRef.current < 10_000) return;
    lastPresenceFetchRef.current = now;
    fetchVerifiedUsers();
  }, [onlineUsers, verifiedUsers, fetchVerifiedUsers]);

  // Auto-scroll when messages change or panel opens
  useEffect(() => {
    if (open) {
      const justOpened = !wasOpenRef.current;
      wasOpenRef.current = true;
      if (justOpened) {
        // Panel just opened — always scroll to bottom
        setTimeout(scrollToBottom, 50);
      } else if (listRef.current && isNearBottom(listRef.current)) {
        // New message + user is near bottom — scroll
        setTimeout(scrollToBottom, 50);
      }
    } else {
      wasOpenRef.current = false;
    }
  }, [messages, open, scrollToBottom, isNearBottom]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        toggleRef.current &&
        !toggleRef.current.contains(target)
      ) {
        setOpen(false);
        setFullscreen(false);
        openRef.current = false;
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Listen for closeChatPanel event (e.g. when YouTube link clicked)
  useEffect(() => {
    const handler = () => {
      setOpen(false);
      setFullscreen(false);
      openRef.current = false;
    };
    window.addEventListener("closeChatPanel", handler);
    return () => window.removeEventListener("closeChatPanel", handler);
  }, []);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;

    const isBN = breakingNews && isAdmin;
    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, isBreakingNews: isBN }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        setInput("");
        setBreakingNews(false);

        // Broadcast to other clients
        channelRef.current?.send({
          type: "broadcast",
          event: "new_message",
          payload: data.message,
        });

        // Trigger BN overlay (local + other tabs via broadcast)
        if (isBN) {
          window.dispatchEvent(new CustomEvent("breakingNews", { detail: data.message }));
        }
      }
    } catch (e) {
      console.error("Failed to send message:", e);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    try {
      const res = await fetch("/api/messages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });

      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));

        // Broadcast deletion to other clients
        channelRef.current?.send({
          type: "broadcast",
          event: "delete_message",
          payload: { id: messageId },
        });
      }
    } catch (e) {
      console.error("Failed to delete message:", e);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = messages[0].createdAt;
      const res = await fetch(`/api/messages?limit=10&before=${encodeURIComponent(oldest)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.messages) {
        const older = (data.messages as Message[]).reverse();
        const el = listRef.current;
        const prevHeight = el?.scrollHeight ?? 0;
        setMessages((prev) => [...older, ...prev]);
        setHasMore(!!data.hasMore);
        // Preserve scroll position after prepending
        if (el) {
          requestAnimationFrame(() => {
            el.scrollTop += el.scrollHeight - prevHeight;
          });
        }
      }
    } catch (e) {
      console.error("Failed to load more messages:", e);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Toggle button */}
      <Tooltip label="Chat">
        <button
          ref={toggleRef}
          className="chat-toggle-btn"
          onClick={() => {
            setOpen((o) => {
              const next = !o;
              openRef.current = next;
              if (next) {
                setHasUnread(false);
              } else {
                setFullscreen(false);
              }
              return next;
            });
          }}
          aria-label={open ? "Close chat" : "Open chat"}
        >
          {open ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 3.5C2 2.67 2.67 2 3.5 2H12.5C13.33 2 14 2.67 14 3.5V9.5C14 10.33 13.33 11 12.5 11H5L2 14V3.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
          )}
          {hasUnread && !open && <span className="chat-unread-dot" />}
        </button>
      </Tooltip>

      {/* Chat panel */}
      {open && (
        <div ref={panelRef} className={`chat-panel${fullscreen ? " chat-panel-fullscreen" : ""}`}>
          <div className="chat-header">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span className="chat-title">Chat</span>
              <span className="chat-count">{messages.length}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <button
                className="chat-fullscreen-btn"
                onClick={() => setFullscreen((f) => !f)}
                aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
                title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {fullscreen ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M5 1V4H1M9 1V4H13M5 13V10H1M9 13V10H13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1 5V1H5M13 5V1H9M1 9V13H5M13 9V13H9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            <button
              className="chat-users-toggle"
              onClick={() => setShowUsers((s) => !s)}
              aria-label={showUsers ? "Hide users" : "Show users"}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="5" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M1 12C1 9.79 2.79 8 5 8C7.21 8 9 9.79 9 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <circle cx="10.5" cy="5" r="1.8" stroke="currentColor" strokeWidth="1.2" />
                <path d="M8.5 12C8.5 10.34 9.34 9 10.5 9C11.66 9 12.5 10.34 12.5 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <span className="chat-users-count">
                {verifiedUsers.length}
              </span>
            </button>
            </div>
          </div>

          <div className="chat-body">
            <div className="chat-messages" ref={listRef}>
              {hasMore && (
                <button
                  className="chat-load-more"
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading..." : "Load more"}
                </button>
              )}
              {messages.length === 0 && (
                <div className="chat-empty">No messages yet</div>
              )}
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  id={msg.id}
                  userName={msg.userName}
                  time={relativeTime(msg.createdAt)}
                  content={msg.content}
                  isOwn={currentUserId === msg.userId}
                  isAdmin={isAdmin}
                  isBreakingNews={msg.isBreakingNews}
                  onDelete={handleDelete}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {showUsers && (
              <div className="chat-users-sidebar">
                <div className="chat-users-header">Users</div>
                <div className="chat-users-list">
                  {[...verifiedUsers].sort((a, b) => {
                      const aOnline = onlineUsers.has(a) ? 0 : 1;
                      const bOnline = onlineUsers.has(b) ? 0 : 1;
                      if (aOnline !== bOnline) return aOnline - bOnline;
                      return a.localeCompare(b, undefined, { sensitivity: 'base' });
                    }).map((name) => (
                    <div key={name} className="chat-user-item">
                      <span className={onlineUsers.has(name) ? "chat-user-dot" : "chat-user-dot-offline"} />
                      {name.toLowerCase()}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="chat-input-area">
            <input
              type="text"
              className={`chat-input${breakingNews ? " chat-input-bn" : ""}`}
              placeholder={breakingNews ? "Breaking news..." : "Type a message..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={500}
              disabled={sending}
            />
            {isAdmin && (
              <label className="chat-bn-toggle" title="Breaking News">
                <input
                  type="checkbox"
                  checked={breakingNews}
                  onChange={(e) => setBreakingNews(e.target.checked)}
                />
                <span className="chat-bn-icon">BN</span>
              </label>
            )}
            <button
              className="chat-send-btn"
              onClick={handleSend}
              disabled={!input.trim() || sending}
              aria-label="Send message"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 7L13 1L7 13L6 8L1 7Z" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
});
