"use client";

import { useSyncExternalStore } from "react";
import { getSupabaseBrowser } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

let onlineUsers = new Set<string>();
let channel: RealtimeChannel | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function initPresence(userName: string) {
  if (channel) return;

  const supabase = getSupabaseBrowser();
  channel = supabase.channel("presence", { config: { presence: { key: userName } } });

  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel!.presenceState();
      onlineUsers = new Set(Object.keys(state));
      notify();
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel!.track({ userName });
      }
    });
}

export function cleanupPresence() {
  if (!channel) return;
  const supabase = getSupabaseBrowser();
  supabase.removeChannel(channel);
  channel = null;
  onlineUsers = new Set();
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Set<string> {
  return onlineUsers;
}

function getServerSnapshot(): Set<string> {
  return new Set<string>();
}

export function useOnlineUsers(): Set<string> {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
