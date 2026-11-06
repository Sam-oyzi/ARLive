"""Synthesises the nature sounds that play on their own in a page's experience.

    python3 scripts/make-nature-sounds.py brook public/book-art/sarra-and-the-little-lost-roar/sounds/brook.m4a

Each sound is one layer (a brook, birds, frogs, an owl), for Studio to mix up to four on a page. Loops
are 40 seconds built from parts that repeat exactly over its length (noise shaped in
the frequency domain, slow swells with a whole number of cycles), with every call or splash wrapped
round the end, so they loop without a seam; the owl is a single call, to play once. The app crossfades loops anyway (src/lib/page-sound.ts),
so a real recording works just as well: these are good placeholders until there are recordings.
Needs numpy, and macOS's afconvert for the .m4a (a .wav path skips that).
"""
import math
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np

RATE = 44100
SECONDS = 40
N = RATE * SECONDS
rng = np.random.default_rng(2026)


def shaped_noise(low, high, tilt=1.0, seed=None):
    """Noise with energy between low and high Hz, falling off as 1/f**tilt; loops exactly."""
    r = np.random.default_rng(seed) if seed is not None else rng
    freqs = np.fft.rfftfreq(N, 1 / RATE)
    gain = np.where((freqs >= low) & (freqs <= high), 1 / np.maximum(freqs, 1) ** (tilt / 2), 0)
    # Soft band edges.
    gain *= np.clip((freqs - low * 0.7) / (low * 0.3 + 1e-9), 0, 1) * np.clip((high * 1.3 - freqs) / (high * 0.3), 0, 1)
    spectrum = gain * np.exp(2j * math.pi * r.random(len(freqs)))
    out = np.fft.irfft(spectrum, N)
    return out / (np.abs(out).max() + 1e-12)


def swell(rate_hz, depth=0.5, seed=0):
    """A slow wandering level between 1-depth and 1, made of whole cycles so it loops."""
    r = np.random.default_rng(seed)
    t = np.arange(N) / RATE
    level = np.zeros(N)
    for k in range(4):
        cycles = max(1, round(rate_hz * SECONDS * (0.6 + 0.8 * r.random())))
        level += np.sin(2 * math.pi * cycles * t / SECONDS + 2 * math.pi * r.random()) / (k + 1)
    level = (level - level.min()) / (level.max() - level.min())
    return 1 - depth + depth * level


def place(track, sound, at, pan=0.0, gain=1.0):
    """Adds a mono sound at `at` seconds, panned (-1 left .. 1 right), wrapping round the loop's end."""
    start = int(at * RATE) % N
    idx = (start + np.arange(len(sound))) % N
    left, right = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
    np.add.at(track[0], idx, sound * gain * left)
    np.add.at(track[1], idx, sound * gain * right)


def envelope(n, attack=0.1, release=0.4):
    t = np.linspace(0, 1, n)
    return np.clip(t / attack, 0, 1) * np.clip((1 - t) / release, 0, 1) ** 1.5


def tone(freqs, duration, harmonics=(1.0,), vibrato=0.0, vibrato_hz=6.0):
    """A pitched call following `freqs` (Hz at the start and end, or a curve), with a soft envelope."""
    n = int(duration * RATE)
    t = np.arange(n) / RATE
    f = np.interp(np.linspace(0, 1, n), np.linspace(0, 1, len(freqs)), freqs)
    f = f * (1 + vibrato * np.sin(2 * math.pi * vibrato_hz * t))
    phase = 2 * math.pi * np.cumsum(f) / RATE
    out = sum(h * np.sin((k + 1) * phase) for k, h in enumerate(harmonics))
    return out


# ---------- creatures and water ----------

def bubble(f0, duration):
    """A brook's bubble: a short rising ping (a bubble's resonance as it reaches the surface)."""
    n = int(duration * RATE)
    t = np.arange(n) / RATE
    f = f0 * (1 + 2.4 * t / duration)
    return np.sin(2 * math.pi * np.cumsum(f) / RATE) * np.exp(-t / (duration / 3.5))


def songbird_phrase():
    """A few varied chirps, the way a small songbird sings: quick high sweeps and a short trill."""
    parts, at = [], 0.0
    base = rng.uniform(2800, 4200)
    for _ in range(rng.integers(3, 7)):
        kind = rng.random()
        if kind < 0.45:  # a quick upward or downward sweep
            d = rng.uniform(0.05, 0.11)
            sweep = [base * rng.uniform(0.8, 1.0), base * rng.uniform(1.15, 1.5)][:: 1 if rng.random() < 0.6 else -1]
            s = tone(sweep, d, (1, 0.15)) * envelope(int(d * RATE), 0.2, 0.5)
        elif kind < 0.75:  # a trill
            d = rng.uniform(0.25, 0.6)
            rate_ = rng.uniform(14, 24)
            n = int(d * RATE)
            t = np.arange(n) / RATE
            f = base * (1.1 + 0.15 * np.sin(2 * math.pi * rate_ * t))
            s = np.sin(2 * math.pi * np.cumsum(f) / RATE) * (0.5 + 0.5 * np.sin(2 * math.pi * rate_ * t) ** 2) * envelope(n, 0.1, 0.3)
        else:  # a clear whistle
            d = rng.uniform(0.15, 0.3)
            s = tone([base * 0.75, base * 0.85, base * 0.8], d, (1, 0.05)) * envelope(int(d * RATE), 0.25, 0.5)
        parts.append((at, s))
        at += len(s) / RATE + rng.uniform(0.03, 0.12)
    out = np.zeros(int(at * RATE) + 1)
    for start, s in parts:
        i = int(start * RATE)
        out[i:i + len(s)] += s
    return out


def cuckoo():
    """'Cu-ckoo': two soft falling notes, repeated."""
    out = []
    for _ in range(rng.integers(2, 4)):
        for f, d in ((680, 0.22), (560, 0.32)):
            out.append(tone([f, f * 0.98], d, (1, 0.2, 0.05)) * envelope(int(d * RATE), 0.25, 0.6))
            out.append(np.zeros(int(0.07 * RATE)))
        out.append(np.zeros(int(0.55 * RATE)))
    return np.concatenate(out)


def owl():
    """A tawny owl's 'hoo ... hoo-hoo-hoooo'."""
    out = [tone([420, 400], 0.45, (1, 0.12), 0.01, 7) * envelope(int(0.45 * RATE), 0.2, 0.5), np.zeros(int(0.9 * RATE))]
    for d in (0.16, 0.16, 0.9):
        out.append(tone([410, 395, 380], d, (1, 0.12), 0.015, 7) * envelope(int(d * RATE), 0.2, 0.5))
        out.append(np.zeros(int(0.08 * RATE)))
    return np.concatenate(out)


def frog():
    """A croak: a buzzing pulse train."""
    d = rng.uniform(0.18, 0.35)
    n = int(d * RATE)
    t = np.arange(n) / RATE
    carrier = np.sin(2 * math.pi * rng.uniform(380, 700) * t) + 0.5 * np.sin(2 * math.pi * rng.uniform(900, 1300) * t)
    pulses = np.clip(np.sin(2 * math.pi * rng.uniform(60, 95) * t), 0, 1) ** 3
    croak = carrier * pulses * envelope(n, 0.15, 0.4)
    return np.concatenate([croak, np.zeros(int(0.12 * RATE)), croak * 0.8]) if rng.random() < 0.5 else croak


def cricket_track(gain=0.05, pan=0.0, seed=0):
    """A cricket chirping steadily all through the loop."""
    r = np.random.default_rng(seed)
    track = np.zeros((2, N))
    f = r.uniform(4200, 4900)
    pulse = tone([f, f], 0.016) * np.hanning(int(0.016 * RATE))
    period = SECONDS / round(SECONDS / r.uniform(0.55, 0.85))
    for k in range(int(SECONDS / period)):
        for p in range(r.integers(3, 5)):
            place(track, pulse, k * period + p * 0.035, pan, gain)
    return track


# ---------- the scenes ----------

def stereo(mono_l, mono_r=None):
    return np.stack([mono_l, mono_l if mono_r is None else mono_r])


def calls(track, maker, every, gain, pans=(-0.8, 0.8)):
    t = rng.uniform(0, every)
    while t < SECONDS:
        place(track, maker(), t, rng.uniform(*pans), gain * rng.uniform(0.6, 1.0))
        t += every * rng.uniform(0.6, 1.4)


def water(track, gain, rate, low=320, high=1300, flow=0.10):
    """Running water: a soft hiss of flow and many small bubbles."""
    hiss = stereo(shaped_noise(250, 5000, 1.0, 11), shaped_noise(250, 5000, 1.0, 12))
    track += hiss * swell(0.4, 0.4, 3) * flow * gain * 4
    for _ in range(int(rate * SECONDS)):
        place(track, bubble(rng.uniform(low, high), rng.uniform(0.012, 0.045)), rng.uniform(0, SECONDS), rng.uniform(-0.7, 0.7), gain * rng.uniform(0.2, 1.0))


def wind(track, gain, low=90, high=1400, rate=0.08):
    w = stereo(shaped_noise(low, high, 1.4, 21), shaped_noise(low, high, 1.4, 22))
    track += w * swell(rate, 0.75, 5) * gain


def leaves_rustle(track, gain):
    rustle = stereo(shaped_noise(1800, 9000, 0.8, 31), shaped_noise(1800, 9000, 0.8, 32))
    track += rustle * swell(0.12, 0.85, 9) ** 2 * gain


# Each sound is one layer: Studio mixes up to four on a page, with their own volume, delay and loop.

def layer(build):
    track = np.zeros((2, N))
    build(track)
    return track


def brook():
    """A quiet brook, with the odd bigger "plip" and "plop"."""
    def build(track):
        water(track, 0.09, 26)
        for _ in range(14):
            place(track, bubble(rng.uniform(260, 480), rng.uniform(0.05, 0.09)), rng.uniform(0, SECONDS), rng.uniform(-0.4, 0.4), 0.35)
    return layer(build)


def stream():
    """A lively stream rushing downhill."""
    return layer(lambda track: water(track, 0.11, 60, 350, 1500, 0.14))


def songbirds():
    return layer(lambda track: calls(track, songbird_phrase, 3.2, 0.12))


def frogs():
    return layer(lambda track: calls(track, frog, 3.5, 0.16, (-0.6, 0.6)))


def crickets():
    def build(track):
        for k, pan in enumerate((-0.7, -0.2, 0.4, 0.8)):
            track += cricket_track(0.035, pan, 40 + k)
    return layer(build)


def leaves():
    """Leaves in a soft breeze."""
    def build(track):
        wind(track, 0.05, 120, 900)
        leaves_rustle(track, 0.06)
    return layer(build)


def cuckoo_far():
    return layer(lambda track: calls(track, cuckoo, 12, 0.07, (-0.9, -0.3)))


def owl_call():
    """Owl, once: a short sound meant to play once, after a delay."""
    call = owl()
    track = np.zeros((2, len(call) + RATE // 2))
    track[0, :len(call)] = call * 0.8
    track[1, :len(call)] = call * 0.6
    return track


def mountain_wind():
    """Cold wind gusting round the mountains, with a whistle in it."""
    def build(track):
        wind(track, 0.32, 70, 1100, 0.07)
        whistle = stereo(shaped_noise(680, 760, 0.0, 51), shaped_noise(820, 900, 0.0, 52))
        track += whistle * swell(0.06, 1.0, 13) ** 3 * 0.05
    return layer(build)


def waves():
    def build(track):
        surf = stereo(shaped_noise(80, 2500, 1.2, 61), shaped_noise(80, 2500, 1.2, 62))
        t = np.arange(N) / RATE
        rolls = (0.5 + 0.5 * np.sin(2 * math.pi * 5 * t / SECONDS - math.pi / 2)) ** 2.5  # five waves a loop
        track += surf * (0.15 + 0.85 * rolls) * 0.22
    return layer(build)


def rain():
    def build(track):
        track += stereo(shaped_noise(1500, 11000, 0.3, 63), shaped_noise(1500, 11000, 0.3, 64)) * 0.035
        for _ in range(int(9 * SECONDS)):
            place(track, bubble(rng.uniform(1800, 3600), 0.008), rng.uniform(0, SECONDS), rng.uniform(-1, 1), 0.05)
    return layer(build)


def storytime():
    """A gentle music box over soft chords, for the reader's soundtrack: 16 bars at 72 bpm, looping."""
    bpm, bars = 72, 16
    beat = 60 / bpm
    n = int(round(bars * 4 * beat * RATE))
    track = np.zeros((2, n))
    r = np.random.default_rng(72)

    def put(sound, at, pan, gain):
        idx = (int(at * RATE) + np.arange(len(sound))) % n
        left, right = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
        np.add.at(track[0], idx, sound * gain * left)
        np.add.at(track[1], idx, sound * gain * right)

    midi = lambda m: 440 * 2 ** ((m - 69) / 12)

    def tine(freq, seconds=1.6):
        t = np.arange(int(seconds * RATE)) / RATE
        body = np.sin(2 * math.pi * freq * t) + 0.32 * np.sin(2 * math.pi * freq * 2.76 * t) * np.exp(-t * 6) + 0.12 * np.sin(2 * math.pi * freq * 5.4 * t) * np.exp(-t * 10)
        return body * np.exp(-t * 2.4) * np.clip(t / 0.004, 0, 1)

    def pad(freqs, seconds):
        t = np.arange(int(seconds * RATE)) / RATE
        tone_ = sum(np.sin(2 * math.pi * f * t) + 0.2 * np.sin(4 * math.pi * f * t) for f in freqs) / len(freqs)
        return tone_ * np.clip(t / 0.8, 0, 1) * np.clip((seconds - t) / 0.9, 0, 1)

    # C, A minor, F, G: two bars each, twice round.
    chords = [(48, [60, 64, 67]), (45, [57, 60, 64]), (41, [57, 60, 65]), (43, [55, 59, 62])] * 2
    scale = [72, 74, 76, 79, 81, 84]  # C major pentatonic, up high like a music box
    note = 2
    for i, (root, chord) in enumerate(chords):
        start = i * 8 * beat
        put(pad([midi(m) for m in chord], 8 * beat + 0.9), start, 0.0, 0.16)
        put(tine(midi(root), 2.4) * 0.6, start, -0.2, 0.22)
        put(tine(midi(root + 7), 2.0) * 0.5, start + 4 * beat, 0.2, 0.16)
        for step in range(16):  # eighth notes, with rests
            if r.random() < 0.35 or (step % 4 == 3 and r.random() < 0.6):
                continue
            note = int(np.clip(note + r.choice([-2, -1, -1, 0, 1, 1, 2]), 0, len(scale) - 1))
            pitch = scale[note]
            # Lean towards the chord on the beat.
            if step % 2 == 0 and (pitch % 12) not in {m % 12 for m in chord}:
                pitch = min(scale, key=lambda m: (m % 12 not in {c % 12 for c in chord}, abs(m - pitch)))
            put(tine(midi(pitch)), start + step * beat / 2, r.uniform(-0.5, 0.5), r.uniform(0.18, 0.26))
    # A little room around it: two soft echoes, wrapping round the loop's end like everything else.
    room = np.zeros_like(track)
    for delay, gain in ((0.21, 0.28), (0.47, 0.14)):
        room += np.roll(track[::-1], int(delay * RATE), axis=1) * gain
    return track + room


SOUNDS = {
    "storytime": storytime, "brook": brook, "stream": stream, "songbirds": songbirds, "frogs": frogs, "crickets": crickets,
    "leaves": leaves, "cuckoo": cuckoo_far, "owl": owl_call, "mountain-wind": mountain_wind, "waves": waves, "rain": rain,
}


def save(track, path):
    track = track - track.mean(axis=1, keepdims=True)
    # The same loudness for every sound (-22 dBFS RMS), with the odd loud call softly held under 0.8,
    # so one page isn't louder than the next. The app sets the final level.
    track = track * (10 ** (-22 / 20) / (np.sqrt((track ** 2).mean()) + 1e-12))
    track = np.where(np.abs(track) > 0.6, np.sign(track) * (0.6 + 0.2 * np.tanh((np.abs(track) - 0.6) / 0.2)), track)
    pcm = (np.clip(track.T, -1, 1) * 32767).astype("<i2")
    wav = path if path.endswith(".wav") else tempfile.mktemp(suffix=".wav")
    with wave.open(wav, "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(pcm.tobytes())
    if wav != path:
        subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "128000", wav, path], check=True)
        os.remove(wav)


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] not in SOUNDS:
        sys.exit(f"usage: {{{','.join(SOUNDS)}}} out.m4a")
    save(SOUNDS[sys.argv[1]](), sys.argv[2])
