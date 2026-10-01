"use client";

import { useState } from "react";
import type { DayCount } from "@/lib/stats";

/** Single-series column chart: scans per day. Hover any column for its value. */
export function ScansChart({ data, height = 180 }: { data: DayCount[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  // Round the axis up to an even number so the midline tick is a whole number.
  const max = Math.max(2, Math.ceil(Math.max(...data.map((d) => d.count)) / 2) * 2);
  const peak = data.reduce((best, d, i) => (d.count > (data[best]?.count ?? -1) ? i : best), 0);
  const ticks = [max, max / 2, 0];

  return (
    <div>
      <div className="flex gap-3">
        <div className="flex flex-col justify-between text-right text-[11px] text-ink-400 tabular-nums" style={{ height }}>
          {ticks.map((t, i) => (
            <span key={i} className="-translate-y-1/2 last:translate-y-1/2">
              {t}
            </span>
          ))}
        </div>
        <div className="relative flex-1" style={{ height }}>
          {/* recessive hairline grid */}
          {[0, 0.5, 1].map((f) => (
            <div key={f} className="absolute inset-x-0 h-px bg-ink-100" style={{ top: `${f * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-0.5" onMouseLeave={() => setHover(null)}>
            {data.map((d, i) => {
              const h = (d.count / max) * height;
              return (
                <div
                  key={i}
                  className="relative flex h-full flex-1 cursor-default items-end justify-center"
                  onMouseEnter={() => setHover(i)}
                >
                  {hover === i && <div className="absolute inset-0 rounded-md bg-ink-100/60" />}
                  <div
                    className="relative w-full max-w-6 rounded-t-[4px] bg-brand-500 transition-[height,opacity] duration-500"
                    style={{ height: Math.max(d.count ? 3 : 0, h), opacity: hover === null || hover === i ? 1 : 0.55 }}
                  />
                  {i === peak && d.count > 0 && hover === null && (
                    <span
                      className="absolute text-[11px] font-semibold text-ink-700 tabular-nums"
                      style={{ bottom: Math.max(3, h) + 4 }}
                    >
                      {d.count}
                    </span>
                  )}
                  {hover === i && (
                    <div
                      className="pointer-events-none absolute z-10 rounded-xl bg-ink-900 px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lift"
                      style={{ bottom: Math.max(3, h) + 8 }}
                    >
                      <div className="font-semibold tabular-nums">{d.count} scans</div>
                      <div className="text-white/60">{d.label}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-2 flex gap-0.5 pl-8 text-[11px] text-ink-400">
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-center">
            {i % 2 === data.length % 2 ? d.label.split(" ")[1] : ""}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Scans per day</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th>{d.label}</th>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
