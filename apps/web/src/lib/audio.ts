'use client';

import { fetchBlobUrl } from './api';

export interface Turn {
  speaker: string;
  text: string;
}

const FEMALE = /female|zira|samantha|susan|karen|victoria|moira|tessa|fiona|hazel|google uk english female|aria|jenny/i;
const MALE = /\bmale\b|david|alex|daniel|mark|fred|george|oliver|google uk english male|guy|ryan/i;

function voices(): SpeechSynthesisVoice[] {
  return typeof window === 'undefined' ? [] : window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
}

function pickVoice(speaker: string): { voice?: SpeechSynthesisVoice; pitch: number } {
  const list = voices();
  const wantFemale = /woman|female|announcer|trainer/i.test(speaker);
  const match = list.find((v) => (wantFemale ? FEMALE : MALE).test(v.name));
  return { voice: match ?? list[0], pitch: match ? 1 : wantFemale ? 1.2 : 0.8 };
}

/** Speak a single utterance with the browser's speech synthesis. Resolves when finished. */
export function speakText(text: string, speaker = 'Woman', rate = 0.95): { done: Promise<void>; cancel: () => void } {
  const synth = window.speechSynthesis;
  const done = new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    const { voice, pitch } = pickVoice(speaker);
    if (voice) u.voice = voice;
    u.lang = 'en-US';
    u.rate = rate;
    u.pitch = pitch;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.speak(u);
  });
  return {
    done,
    cancel: () => synth.cancel(),
  };
}

/** Play dialogue turns once (browser TTS fallback). */
export function playTurnsWithBrowser(turns: Turn[], onProgress?: (i: number) => void): { done: Promise<void>; cancel: () => void } {
  let stop = false;
  const synth = window.speechSynthesis;
  const done = (async () => {
    for (let i = 0; i < turns.length; i++) {
      if (stop) return;
      onProgress?.(i);
      await speakText(turns[i].text, turns[i].speaker).done;
      await new Promise((r) => setTimeout(r, 250));
    }
  })();
  return {
    done,
    cancel: () => {
      stop = true;
      synth.cancel();
    },
  };
}

/** Play server-generated audio clips in order (authenticated fetch → blob). */
export function playUrls(paths: string[], onProgress?: (i: number) => void): { done: Promise<void>; cancel: () => void } {
  let stop = false;
  let current: HTMLAudioElement | null = null;
  const done = (async () => {
    for (let i = 0; i < paths.length; i++) {
      if (stop) return;
      onProgress?.(i);
      const url = await fetchBlobUrl(paths[i]);
      await new Promise<void>((resolve) => {
        const el = new Audio(url);
        current = el;
        el.onended = () => resolve();
        el.onerror = () => resolve();
        void el.play().catch(() => resolve());
      });
      await new Promise((r) => setTimeout(r, 200));
    }
  })();
  return {
    done,
    cancel: () => {
      stop = true;
      current?.pause();
    },
  };
}

/** Plays a stimulus once: server audio if available, otherwise browser speech. */
export function playStimulus(meta: { audioUrls?: string[]; turns?: Turn[] }, onProgress?: (i: number) => void) {
  if (meta.audioUrls?.length) return playUrls(meta.audioUrls, onProgress);
  return playTurnsWithBrowser(meta.turns ?? [], onProgress);
}

/** Short beep used to signal "recording starts now". */
export async function beep(freq = 880, ms = 180): Promise<void> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  gain.gain.value = 0.15;
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  await new Promise((r) => setTimeout(r, ms));
  osc.stop();
  await ctx.close();
}
