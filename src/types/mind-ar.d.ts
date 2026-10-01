// Minimal types for the parts of MindAR's browser bundle we use.
declare module "mind-ar/dist/mindar-image.prod.js" {
  export type MindARUpdate =
    | { type: "updateMatrix"; targetIndex: number; worldMatrix: number[] | null }
    | { type: "processDone" }
    | { type: string; [key: string]: unknown };

  export class Controller {
    constructor(options: {
      inputWidth: number;
      inputHeight: number;
      onUpdate?: (data: MindARUpdate) => void;
      debugMode?: boolean;
      maxTrack?: number;
      warmupTolerance?: number | null;
      missTolerance?: number | null;
      filterMinCF?: number | null;
      filterBeta?: number | null;
    });
    inputWidth: number;
    inputHeight: number;
    addImageTargets(url: string): Promise<{ dimensions: [number, number][] }>;
    addImageTargetsFromBuffer(buffer: ArrayBuffer): { dimensions: [number, number][] };
    dummyRun(input: HTMLVideoElement): void;
    getProjectionMatrix(): number[];
    processVideo(input: HTMLVideoElement): void;
    stopProcessVideo(): void;
    dispose(): void;
  }

  export class Compiler {
    compileImageTargets(
      images: (HTMLImageElement | HTMLCanvasElement)[],
      progressCallback: (percent: number) => void,
    ): Promise<unknown[]>;
    exportData(): Uint8Array;
  }
}
