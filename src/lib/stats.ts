export type DayCount = { label: string; count: number };

export function daysAgo(days: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Bucket timestamps into the last `days` calendar days (oldest first). */
export function bucketByDay(dates: Date[], days = 14): DayCount[] {
  const fmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
  const start = daysAgo(days - 1);
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return { key: dayKey(d), label: fmt.format(d), count: 0 };
  });
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  for (const date of dates) {
    const i = index.get(dayKey(new Date(date)));
    if (i !== undefined) buckets[i]!.count++;
  }
  return buckets.map(({ label, count }) => ({ label, count }));
}
