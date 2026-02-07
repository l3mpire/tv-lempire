"use client";

import { useSyncExternalStore } from "react";

type Snapshot = {
  now: number;
};

let state: Snapshot = { now: Date.now() };
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function start() {
  if (timer) return;
  timer = setInterval(() => {
    state = { now: Date.now() };
    listeners.forEach((listener) => listener());
  }, 1000);
}

function stop() {
  if (!timer || listeners.size > 0) return;
  clearInterval(timer);
  timer = null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) start();
  return () => {
    listeners.delete(listener);
    stop();
  };
}

function getSnapshot(): Snapshot {
  return state;
}

function getServerSnapshot(): Snapshot {
  return { now: Date.now() };
}

export function useNow(): number {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return snap.now;
}
