export {};

declare global {
  interface Window {
    mucDesktop?: {
      openCasioEmulator: () => Promise<{ ok: boolean; cancelled?: boolean; message: string }>;
      chooseCasioEmulator: () => Promise<{ ok: boolean; cancelled?: boolean; message: string }>;
      readClipboardImage: () => Promise<string | null>;
    };
  }
}
