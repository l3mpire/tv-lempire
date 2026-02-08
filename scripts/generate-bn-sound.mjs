// Generate a simple breaking news alert tone as WAV
// Usage: node scripts/generate-bn-sound.mjs

import { writeFileSync } from "fs";

const SAMPLE_RATE = 44100;
const DURATION = 1.0; // seconds
const NUM_SAMPLES = Math.floor(SAMPLE_RATE * DURATION);
const NUM_CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

// Generate ascending beeps: 3 short tones at 880Hz, 1100Hz, 1320Hz
function generateSamples() {
  const samples = new Int16Array(NUM_SAMPLES);
  const beeps = [
    { freq: 880, start: 0.0, end: 0.15 },
    { freq: 1100, start: 0.2, end: 0.35 },
    { freq: 1320, start: 0.4, end: 0.7 },
  ];

  for (let i = 0; i < NUM_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    let value = 0;

    for (const beep of beeps) {
      if (t >= beep.start && t <= beep.end) {
        const beepDuration = beep.end - beep.start;
        const beepT = (t - beep.start) / beepDuration;
        // Envelope: quick attack, sustain, quick release
        let envelope = 1;
        if (beepT < 0.05) envelope = beepT / 0.05;
        else if (beepT > 0.85) envelope = (1 - beepT) / 0.15;

        value += Math.sin(2 * Math.PI * beep.freq * t) * envelope * 0.6;
      }
    }

    // Clamp
    value = Math.max(-1, Math.min(1, value));
    samples[i] = Math.floor(value * 32767);
  }

  return samples;
}

function writeWav(filePath, samples) {
  const dataSize = samples.length * (BITS_PER_SAMPLE / 8);
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // fmt chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(NUM_CHANNELS, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * NUM_CHANNELS * (BITS_PER_SAMPLE / 8), 28);
  buffer.writeUInt16LE(NUM_CHANNELS * (BITS_PER_SAMPLE / 8), 32);
  buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);

  // data chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    buffer.writeInt16LE(samples[i], 44 + i * 2);
  }

  writeFileSync(filePath, buffer);
}

const samples = generateSamples();
writeWav("public/sounds/breaking-news.wav", samples);
console.log("Generated public/sounds/breaking-news.wav");
