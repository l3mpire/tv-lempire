"use client";

import { useSyncExternalStore } from "react";

let now = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function tick() {
  now = Date.now();
  listeners.forEach((l) => l());
}

function start() {
  if (timer !== null) return;
  timer = setInterval(tick, 1000);
}

function stop() {
  if (timer === null || listeners.size > 0) return;
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

function getSnapshot(): number {
  return now;
}

function getServerSnapshot(): number {
  return Date.now();
}

export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
