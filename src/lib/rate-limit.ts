// Counts failed attempts per key in a fixed window. The counters live in this process's memory, so
// this protects one server; with several instances, move them to Redis or the database.
type Entry = { count: number; resetAt: number };

const MAX_ENTRIES = 50_000;
const entries = new Map<string, Entry>();

export function isBlocked(key: string, limit: number, now = Date.now()): boolean {
  const entry = entries.get(key);
  return !!entry && entry.resetAt > now && entry.count >= limit;
}

export function recordFailure(key: string, windowMs: number, now = Date.now()) {
  const entry = entries.get(key);
  if (entry && entry.resetAt > now) {
    entry.count++;
    return;
  }
  entries.delete(key);
  if (entries.size >= MAX_ENTRIES) makeRoom(now);
  entries.set(key, { count: 1, resetAt: now + windowMs });
}

export function clearFailures(key: string) {
  entries.delete(key);
}

/** Random usernames must not be able to grow the map forever. */
function makeRoom(now: number) {
  for (const [key, entry] of entries) {
    if (entry.resetAt <= now) entries.delete(key);
  }
  if (entries.size >= MAX_ENTRIES) entries.delete(entries.keys().next().value!);
}
