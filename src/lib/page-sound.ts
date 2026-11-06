// A page's sounds (a brook, birds, an owl) in its experience: MindAR, 8th Wall, the story box and the
// 360° view. Up to four play together, each with its own volume, start delay, and loop or once.
// Recordings rarely loop cleanly, so looping copies overlap with a crossfade. One Web Audio context
// serves the whole app. The first tap anywhere unlocks it (SoundUnlock in the root layout), so sounds
// can start on their own later, for example when a printed page is recognised.
import { useEffect, useRef } from "react";

import type { SoundLayer } from "./sound-layers";

export type { SoundLayer } from "./sound-layers";

/** Seconds each copy takes to fade into the next. */
const CROSSFADE = 2.5;
/** How far ahead copies are scheduled, in seconds. */
const LOOKAHEAD = 3;
/** Under a voice, the background drops to this share of its volume. */
export const DUCKED = 0.35;

/** Short sounds get a shorter crossfade, so most of each copy is heard at full volume. */
export function crossfadeFor(duration: number): number {
  return Math.min(CROSSFADE, duration / 4);
}

export function soundLevel(volume: number, { muted, ducked }: { muted: boolean; ducked: boolean }): number {
  return muted ? 0 : ducked ? volume * DUCKED : volume;
}

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };
type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

let context: AudioContext | null = null;
let listening = false;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!context) {
    const Context = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
    if (!Context) return null;
    context = new Context();
  }
  return context;
}

/** Lets sound start, which browsers only allow from a tap. Safe to call on every tap. */
export function unlockSound() {
  const ctx = audioContext();
  if (!ctx || ctx.state === "running" || document.hidden) return;
  // On iPhone, Web Audio otherwise follows the silent switch while <audio> voices don't.
  const session = (navigator as AudioSessionNavigator).audioSession;
  if (session && session.type !== "playback") session.type = "playback";
  void ctx.resume().catch(() => {});
  // Older iPhones also need a sound started inside the tap itself.
  const blip = ctx.createBufferSource();
  blip.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
  blip.connect(ctx.destination);
  blip.start();
}

/** Unlocks sound on taps and goes quiet while the page is hidden. Installed once. */
export function listenForSound() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  for (const type of ["pointerup", "touchend", "click", "keydown"]) {
    window.addEventListener(type, unlockSound, { capture: true, passive: true });
  }
  document.addEventListener("visibilitychange", () => {
    // Quick Look, another app or another tab: nothing keeps playing behind it.
    if (document.hidden) void context?.suspend().catch(() => {});
    else void context?.resume().catch(() => {});
  });
}

const decoded = new Map<string, Promise<AudioBuffer>>();

function loadSound(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  let buffer = decoded.get(url);
  if (!buffer) {
    buffer = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Couldn't load ${url}`);
        return response.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data));
    buffer.catch(() => decoded.delete(url));
    decoded.set(url, buffer);
    // A few pages' sounds are plenty to keep decoded on a phone.
    if (decoded.size > 4) decoded.delete(decoded.keys().next().value!);
  }
  return buffer;
}

export type StopMode = "fade" | "immediate";
export type PageSound = { setMuted(muted: boolean): void; setDucked(ducked: boolean): void; stop(mode?: StopMode): void };

const SILENT: PageSound = { setMuted() {}, setDucked() {}, stop() {} };
const grouped = new Map<string, Set<PageSound>>();

function registerSound(group: string, sound: PageSound) {
  if (!group) return;
  let sounds = grouped.get(group);
  if (!sounds) {
    sounds = new Set<PageSound>();
    grouped.set(group, sounds);
  }
  sounds.add(sound);
}

function unregisterSound(group: string, sound: PageSound) {
  if (!group) return;
  const sounds = grouped.get(group);
  if (!sounds) return;
  sounds.delete(sound);
  if (sounds.size === 0) grouped.delete(group);
}

/** Lets one part of the app hand sound straight over to another. */
export function stopSoundGroup(group: string, mode: StopMode = "immediate") {
  grouped.get(group)?.forEach((sound) => sound.stop(mode));
}

/**
 * Starts a sound after its delay, fading it in, and loops it (or plays it once) until stop(). A missing
 * or unreadable file just stays silent.
 */
export function playPageSound({ url, volume, loop, delay }: SoundLayer, { muted = false }: { muted?: boolean } = {}): PageSound {
  const ctx = audioContext();
  if (!ctx) return SILENT;
  listenForSound();
  const output = ctx.createGain();
  output.gain.value = 0;
  output.connect(ctx.destination);
  const state = { muted, ducked: false };
  const copies = new Set<AudioBufferSourceNode>();
  let loaded = false;
  let stopped = false;
  let timer = 0;
  let finishTimer = 0;

  const fadeTo = (level: number, seconds: number) => {
    const now = ctx.currentTime;
    output.gain.cancelScheduledValues(now);
    output.gain.setValueAtTime(output.gain.value, now);
    output.gain.linearRampToValueAtTime(level, now + seconds);
  };

  loadSound(ctx, url)
    .then((buffer) => {
      if (stopped) return;
      loaded = true;
      let next = ctx.currentTime + 0.05 + Math.max(0, delay);
      if (!loop) {
        const once = ctx.createBufferSource();
        once.buffer = buffer;
        once.connect(output);
        once.onended = () => copies.delete(once);
        once.start(next);
        copies.add(once);
        fadeTo(soundLevel(volume, state), 0.05);
        return;
      }
      const fade = crossfadeFor(buffer.duration);
      const schedule = () => {
        // While the context waits for a tap its clock stands still, so only one copy is queued.
        while (next < ctx.currentTime + LOOKAHEAD) {
          const copy = ctx.createBufferSource();
          copy.buffer = buffer;
          const envelope = ctx.createGain();
          envelope.gain.setValueAtTime(0, next);
          envelope.gain.linearRampToValueAtTime(1, next + fade);
          envelope.gain.setValueAtTime(1, next + buffer.duration - fade);
          envelope.gain.linearRampToValueAtTime(0, next + buffer.duration);
          copy.connect(envelope).connect(output);
          copy.onended = () => {
            copies.delete(copy);
            envelope.disconnect();
          };
          copy.start(next);
          copy.stop(next + buffer.duration);
          copies.add(copy);
          next += buffer.duration - fade;
        }
      };
      schedule();
      timer = window.setInterval(schedule, 1000);
      fadeTo(soundLevel(volume, state), 1.5);
    })
    .catch(() => {});

  const finish = () => {
    window.clearTimeout(finishTimer);
    for (const copy of copies) {
      try {
        copy.stop();
      } catch {
        // not started yet
      }
    }
    copies.clear();
    output.disconnect();
  };

  return {
    setMuted(value) {
      state.muted = value;
      if (loaded && !stopped) fadeTo(soundLevel(volume, state), 0.3);
    },
    setDucked(value) {
      state.ducked = value;
      if (loaded && !stopped) fadeTo(soundLevel(volume, state), 0.6);
    },
    stop(mode = "fade") {
      if (stopped) return;
      stopped = true;
      window.clearInterval(timer);
      if (mode === "immediate") {
        finish();
        return;
      }
      fadeTo(0, 0.4);
      finishTimer = window.setTimeout(finish, 450);
    },
  };
}

/**
 * Plays a page's sounds while they're set. When the set changes, only the changed ones fade out or in:
 * a soundtrack that carries on to the next page keeps playing where it was.
 */
export function usePageSounds(layers: SoundLayer[] | null | undefined, { muted = false, ducked = false, group = "" }: { muted?: boolean; ducked?: boolean; group?: string } = {}) {
  const playing = useRef(new Map<string, PageSound>());
  const latest = useRef({ muted, ducked });
  latest.current = { muted, ducked };
  // Compare by value: the parent may pass an equal list as a new array on every render.
  const key = layers?.length ? JSON.stringify(layers) : "";

  useEffect(() => {
    const wanted = new Map((key ? (JSON.parse(key) as SoundLayer[]) : []).map((layer) => [JSON.stringify(layer), layer]));
    for (const [id, sound] of playing.current) {
      if (wanted.has(id)) continue;
      sound.stop();
      unregisterSound(group, sound);
      playing.current.delete(id);
    }
    for (const [id, layer] of wanted) {
      if (playing.current.has(id)) continue;
      const sound = playPageSound(layer, { muted: latest.current.muted });
      sound.setDucked(latest.current.ducked);
      playing.current.set(id, sound);
      registerSound(group, sound);
    }
  }, [group, key]);
  useEffect(() => {
    const sounds = playing.current;
    return () => {
      sounds.forEach((sound) => {
        sound.stop();
        unregisterSound(group, sound);
      });
      sounds.clear();
    };
  }, [group]);
  useEffect(() => playing.current.forEach((sound) => sound.setMuted(muted)), [muted]);
  useEffect(() => playing.current.forEach((sound) => sound.setDucked(ducked)), [ducked]);
}
