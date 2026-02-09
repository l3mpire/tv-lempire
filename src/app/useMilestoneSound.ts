"use client";

import { useEffect, useRef } from "react";

const MILESTONE_STEP = 10_000;

function getMilestone(arr: number): number {
  return Math.floor(arr / MILESTONE_STEP);
}

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (audioCtx) return audioCtx;
  try {
    audioCtx = new AudioContext();
    return audioCtx;
  } catch {
    return null;
  }
}

function playChaChing() {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const t = ctx.currentTime;



  // --- "CHING" — bell ring (delayed 120ms) ---
  const c = t + 0.12;

  // Noise transient for metallic attack
  const noiseBuf2 = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
  const noiseData2 = noiseBuf2.getChannelData(0);
  for (let i = 0; i < noiseData2.length; i++) {
    noiseData2[i] = Math.random() * 2 - 1;
  }
  const noise2 = ctx.createBufferSource();
  noise2.buffer = noiseBuf2;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 6000;
  const ng2 = ctx.createGain();
  ng2.gain.setValueAtTime(0, t);
  ng2.gain.setValueAtTime(0.4, c);
  ng2.gain.exponentialRampToValueAtTime(0.001, c + 0.12);
  noise2.connect(hp).connect(ng2).connect(ctx.destination);
  noise2.start(t);
  noise2.stop(c + 0.2);

  // Bell body — two detuned sines for chorus/shimmer
  const bellFreqs = [1567.98, 1661.22]; // G6, G#6 — slight detuning
  bellFreqs.forEach((freq) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, c);
    g.gain.setValueAtTime(0, t);
    g.gain.setValueAtTime(0.35, c);
    g.gain.exponentialRampToValueAtTime(0.001, c + 2.4);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(c + 2.4);
  });

  // Bright harmonics — triangle waves for metallic ring
  const ringFreqs = [3135.96, 4186.01]; // G7, C8
  ringFreqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, c);
    g.gain.setValueAtTime(0, t);
    g.gain.setValueAtTime(0.15 / (i + 1), c);
    g.gain.exponentialRampToValueAtTime(0.001, c + 1.6);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(c + 1.6);
  });
}

export function useMilestoneSound(totalARR: number | null, enabled: boolean) {
  const prevMilestoneRef = useRef<number | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (totalARR === null) return;

    const currentMilestone = getMilestone(totalARR);

    // First render: record starting milestone, no sound
    if (!initializedRef.current) {
      prevMilestoneRef.current = currentMilestone;
      initializedRef.current = true;
      return;
    }

    // Milestone crossed — play sound if enabled
    if (
      enabled &&
      prevMilestoneRef.current !== null &&
      currentMilestone > prevMilestoneRef.current
    ) {
      playChaChing();
    }

    prevMilestoneRef.current = currentMilestone;
  }, [totalARR]);
}
