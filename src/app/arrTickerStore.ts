"use client";

import { useSyncExternalStore } from "react";

let now = Date.now();
let lastSecond = Math.floor(now / 1000);
let raf: number | null = null;
const listeners = new Set<() => void>();

function tick() {
  raf = requestAnimationFrame(tick);
  const t = Date.now();
  const sec = Math.floor(t / 1000);
  if (sec === lastSecond) return;
  lastSecond = sec;
  now = t;
  listeners.forEach((l) => l());
}

function start() {
  if (raf !== null) return;
  raf = requestAnimationFrame(tick);
}

function stop() {
  if (raf === null || listeners.size > 0) return;
  cancelAnimationFrame(raf);
  raf = null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) start();
  return () => {
    listeners.delete(listener);
    stop();
  };
}

function getSnapshot(): number {
  return now;
}

function getServerSnapshot(): number {
  return Date.now();
}

export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
