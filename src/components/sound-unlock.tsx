"use client";

import { useEffect } from "react";
import { listenForSound } from "@/lib/page-sound";

/** Browsers only allow sound after a tap: listening from the start lets page sounds play on their own later. */
export function SoundUnlock() {
  useEffect(() => listenForSound(), []);
  return null;
}
