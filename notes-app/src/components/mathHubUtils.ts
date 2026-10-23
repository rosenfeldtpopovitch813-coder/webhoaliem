export type MathHubProps = {
  onClose: () => void;
  onOpenGraph: () => void;
  onOpenLibrary: () => void;
  onOpen3D: () => void;
  onOpenCalculator: () => void;
  onInsert: (src: string, label: string, aspectRatio?: number) => void;
};

export const fmt = (v: number, d = 3) =>
  Number.isFinite(v)
    ? Number(v.toFixed(d)).toLocaleString('vi-VN', { maximumFractionDigits: d })
    : 'không xác định';

export const svgUri = (s: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}`;
