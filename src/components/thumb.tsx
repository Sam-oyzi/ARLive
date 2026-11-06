import Image from "next/image";
import type { CSSProperties } from "react";

/**
 * A book page or cover shown small. Serves a resized copy, because the original can be many MB
 * and students are often on school Wi-Fi or mobile data. Images load lazily by default.
 */
export function Thumb({
  src,
  alt = "",
  title,
  width,
  height,
  className,
  style,
  fetchPriority,
}: {
  src: string;
  alt?: string;
  title?: string;
  /** The size it's displayed at, in CSS pixels. */
  width: number;
  height: number;
  className?: string;
  style?: CSSProperties;
  fetchPriority?: "high" | "low" | "auto";
}) {
  // Only uploads are allowed through the optimiser (next.config.ts), and SVG art is already small.
  const optimizable = src.startsWith("/files/") && !src.endsWith(".svg");
  return <Image src={src} alt={alt} title={title} width={width} height={height} className={className} style={style} fetchPriority={fetchPriority} unoptimized={!optimizable} />;
}
