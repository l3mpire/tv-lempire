"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/supabase";
import LinkedContent from "./LinkedContent";

type Message = {
  id: string;
  content: string;
  userId: string;
  userName: string;
  createdAt: string;
  isBreakingNews?: boolean;
};

const DEFAULT_SCROLL_SPEED = 60; // pixels per second

export default function NewsTicker({ tvMode = false, cinemaMode = false, scrollSpeed = DEFAULT_SCROLL_SPEED }: { tvMode?: boolean; cinemaMode?: boolean; scrollSpeed?: number }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [renderMessages, setRenderMessages] = useState<Message[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<Message[]>([]);
  const pausedRef = useRef(false);
  const offsetRef = useRef(0);
  const groupWidthRef = useRef(0);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef(0);
  const scrollSpeedRef = useRef(scrollSpeed);

  scrollSpeedRef.current = scrollSpeed;

  // Fetch messages + subscribe to realtime
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const [normalRes, bnRes] = await Promise.all([
          fetch("/api/messages?limit=20&breaking=false"),
          fetch("/api/messages?limit=5&breaking=true"),
        ]);
        if (!normalRes.ok || !bnRes.ok) return;
        const [normalData, bnData] = await Promise.all([normalRes.json(), bnRes.json()]);
        const normal: Message[] = normalData.messages ?? [];
        const bn: Message[] = bnData.messages ?? [];
        // Merge, dedup by id, sort by createdAt ASC
        const seen = new Set<string>();
        const merged = [...normal, ...bn]
          .filter((m) => {
            if (seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
          })
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setMessages(merged);
      } catch {
        // Silently fail — ticker is non-critical
      }
    };
    fetchMessages();

    const supabase = getSupabaseBrowser();

    const channel = supabase
      .channel("chat")
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        const msg = payload as Message;
        if (!msg?.id) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        // Trigger BN overlay for remote clients (especially TV mode where ChatOverlay is not mounted)
        if (msg.isBreakingNews) {
          window.dispatchEvent(new CustomEvent("breakingNews", { detail: msg }));
        }
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

  // Defer updates to loop boundary — store pending, apply immediately if first render
  useEffect(() => {
    pendingRef.current = messages;
    if (renderMessages.length === 0 && messages.length > 0) {
      setRenderMessages(messages);
    }
  }, [messages, renderMessages.length]);

  // Measure group width when renderMessages change
  const measureGroupWidth = useCallback(() => {
    if (groupRef.current) {
      groupWidthRef.current = groupRef.current.scrollWidth;
    }
  }, []);

  useEffect(() => {
    measureGroupWidth();
  }, [renderMessages, measureGroupWidth]);

  // Observe resize to keep groupWidth in sync
  useEffect(() => {
    if (!groupRef.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measureGroupWidth);
    observer.observe(groupRef.current);
    return () => observer.disconnect();
  }, [renderMessages, measureGroupWidth]);

  // rAF scroll loop
  useEffect(() => {
    if (renderMessages.length === 0) return;

    const tick = (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }

      const delta = (timestamp - lastTimeRef.current) / 1000; // seconds
      lastTimeRef.current = timestamp;

      if (!pausedRef.current && groupWidthRef.current > 0) {
        offsetRef.current += scrollSpeedRef.current * delta;

        // Seamless loop: snap back when we've scrolled one full group
        if (offsetRef.current >= groupWidthRef.current) {
          offsetRef.current -= groupWidthRef.current;

          // Safe moment to swap pending messages (at loop boundary)
          const next = pendingRef.current;
          if (next.length > 0 && next !== renderMessages) {
            setRenderMessages(next);
          }
        }
      }

      if (trackRef.current) {
        trackRef.current.style.transform = `translateX(-${offsetRef.current}px)`;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = 0;
    };
  }, [renderMessages]);

  if (renderMessages.length === 0) return null;

  return (
    <div
      className={`news-ticker${cinemaMode ? " news-ticker-cinema" : ""}`}
      style={tvMode ? { bottom: 0 } : undefined}
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      <div className="news-ticker-top">
        <span className="news-ticker-label">Breaking News</span>
      </div>
      <div className="news-ticker-bottom">
        <div ref={trackRef} className="news-ticker-track">
          {[false, true].map((isDup) => (
            <div key={isDup ? "dup" : "main"} ref={isDup ? undefined : groupRef} className="news-ticker-group">
              {renderMessages.map((msg) => (
                <span key={isDup ? `dup-${msg.id}` : msg.id} className="news-ticker-item">
                  {msg.isBreakingNews && (
                    <span className="news-ticker-badge-bn">BREAKING</span>
                  )}
                  {Date.now() - new Date(msg.createdAt).getTime() < 3600_000 && (
                    <span className="news-ticker-badge-new">🔥 new</span>
                  )}
                  {!msg.isBreakingNews && (
                    <span className="news-ticker-name">{msg.userName}</span>
                  )}
                  <span className={`news-ticker-content${msg.isBreakingNews ? " news-ticker-content-bn" : ""}`}><LinkedContent content={msg.content} /></span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
