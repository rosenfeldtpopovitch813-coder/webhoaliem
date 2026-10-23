/**
 * Narrow local declarations for the PDF.js browser API used by pdfImport.ts.
 * Some npm/TypeScript setups fail to resolve pdfjs-dist's bundled declaration
 * file even though the runtime dependency is present. Keep this surface small;
 * the actual implementation is still supplied by the pdfjs-dist package.
 */
declare module 'pdfjs-dist' {
  export const GlobalWorkerOptions: {
    workerSrc: string;
  };

  export const Util: {
    transform(matrixA: ArrayLike<number>, matrixB: ArrayLike<number>): number[];
  };

  export function getDocument(options: {
    data: ArrayBuffer | Uint8Array;
    [key: string]: unknown;
  }): {
    promise: Promise<any>;
  };
}
