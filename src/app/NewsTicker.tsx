"use client";

import { useEffect, useState, useRef } from "react";
import { createClient, RealtimeChannel } from "@supabase/supabase-js";

type Message = {
  id: string;
  content: string;
  userId: string;
  userName: string;
  createdAt: string;
};

function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const SCROLL_SPEED = 60; // pixels per second

export default function NewsTicker() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [renderMessages, setRenderMessages] = useState<Message[]>([]);
  const [paused, setPaused] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(20);
  const [distance, setDistance] = useState(0);
  const pendingRef = useRef<Message[]>([]);

  // Fetch messages + subscribe to realtime
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetch("/api/messages");
        if (!res.ok) return;
        const data = await res.json();
        if (data.messages) {
          setMessages(data.messages.reverse());
        }
      } catch {
        // Silently fail — ticker is non-critical
      }
    };
    fetchMessages();

    const supabase = createBrowserSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel("chat")
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        const msg = payload as Message;
        if (!msg?.id) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      })
      .on("broadcast", { event: "delete_message" }, ({ payload }) => {
        const { id } = payload as { id: string };
        if (!id) return;
        setMessages((prev) => prev.filter((m) => m.id !== id));
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, []);

  // Defer updates to loop boundary to avoid mid-scroll overlaps
  useEffect(() => {
    pendingRef.current = messages;
    if (renderMessages.length === 0 && messages.length > 0) {
      setRenderMessages(messages);
    }
  }, [messages, renderMessages.length]);

  // Calculate scroll duration based on group width
  useEffect(() => {
    if (!groupRef.current || renderMessages.length === 0) return;
    const update = () => {
      const groupWidth = groupRef.current?.scrollWidth ?? 0;
      setDistance(groupWidth);
      setDuration(groupWidth / SCROLL_SPEED);
    };

    update();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(groupRef.current);
    return () => observer.disconnect();
  }, [renderMessages]);

  if (renderMessages.length === 0) return null;

  return (
    <div
      className="news-ticker"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="news-ticker-top">
        <span className="news-ticker-label">Breaking News</span>
      </div>
      <div className="news-ticker-bottom">
        <div
          className="news-ticker-track"
          style={{
            animationDuration: `${duration}s`,
            ["--ticker-distance" as string]: `${distance}px`,
            animationPlayState: paused ? "paused" : "running",
          }}
          onAnimationIteration={() => {
            const next = pendingRef.current;
            if (next.length > 0 && next !== renderMessages) {
              setRenderMessages(next);
            }
          }}
        >
          <div ref={groupRef} className="news-ticker-group">
            {renderMessages.map((msg) => (
              <span key={msg.id} className="news-ticker-item">
                <span className="news-ticker-name">{msg.userName}</span>
                <span className="news-ticker-content">{msg.content}</span>
              </span>
            ))}
          </div>
          <div className="news-ticker-group">
            {renderMessages.map((msg) => (
              <span key={`dup-${msg.id}`} className="news-ticker-item">
                <span className="news-ticker-name">{msg.userName}</span>
                <span className="news-ticker-content">{msg.content}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
