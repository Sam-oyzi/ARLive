/** One viewer per recognition. Returning to the same visible paper must not reopen it in a loop. */
export class ScanLaunchGate {
  private opened: string | null = null;
  private launching = false;

  found(id: string, external: boolean): "launch" | "content" | "resume" | "ignore" {
    if (this.launching) return "ignore";
    if (!external) { this.opened = null; return "content"; }
    if (this.opened === id) return "resume";
    this.opened = id;
    this.launching = true;
    return "launch";
  }

  resumeScanning() { this.launching = false; }

  lost(id: string) {
    if (!this.launching && this.opened === id) this.opened = null;
  }
}
