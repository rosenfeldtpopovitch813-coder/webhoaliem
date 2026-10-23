export type HistogramBin = { from: number; to: number; count: number };

export type DescriptiveStatistics = {
  data: number[];
  sorted: number[];
  n: number;
  sum: number;
  mean: number;
  median: number;
  q1: number;
  q3: number;
  iqr: number;
  min: number;
  max: number;
  range: number;
  populationVariance: number;
  populationSd: number;
  sampleVariance: number;
  sampleSd: number;
  variance: number;
  sd: number;
  varianceConvention: 'population (chia cho n)' | 'sample (chia cho n − 1)';
  modes: number[];
  freq: [number, number][];
};

function calcMedian(sortedSlice: number[]): number {
  const len = sortedSlice.length;
  if (len === 0) return NaN;
  if (len % 2 === 1) return sortedSlice[(len - 1) / 2];
  return (sortedSlice[len / 2 - 1] + sortedSlice[len / 2]) / 2;
}

/** Compute descriptive statistics with explicit population (n) vs sample (n-1) variance conventions and safe n=1 quartiles. */
export function computeDescriptiveStatistics(
  rawOrArray: string | number[],
  options: { sample?: boolean } = {},
): DescriptiveStatistics {
  const data = typeof rawOrArray === 'string'
    ? rawOrArray.split(/[\s,;]+/).filter(Boolean).map(Number)
    : [...rawOrArray];
  if (!data.length || data.some(v => !Number.isFinite(v))) {
    throw new Error('Nhập dãy số hữu hạn, ngăn cách bằng dấu phẩy hoặc khoảng trắng.');
  }
  const sample = Boolean(options.sample);
  const a = [...data].sort((x, y) => x - y);
  const n = a.length;
  const sum = data.reduce((s, v) => s + v, 0);
  const mean = sum / n;
  const median = calcMedian(a);
  const q1 = n === 1 ? a[0] : calcMedian(a.slice(0, Math.floor(n / 2)));
  const q3 = n === 1 ? a[0] : calcMedian(a.slice(Math.ceil(n / 2)));
  const ss = data.reduce((s, v) => s + (v - mean) ** 2, 0);
  const populationVariance = ss / n;
  const populationSd = Math.sqrt(populationVariance);
  const sampleVariance = n > 1 ? ss / (n - 1) : 0;
  const sampleSd = Math.sqrt(sampleVariance);
  const variance = sample ? sampleVariance : populationVariance;
  const sd = sample ? sampleSd : populationSd;

  const freqMap = new Map<number, number>();
  data.forEach(v => freqMap.set(v, (freqMap.get(v) || 0) + 1));
  const maxFreq = Math.max(...freqMap.values());
  const modes = [...freqMap].filter(([, f]) => f === maxFreq).map(([v]) => v).sort((x, y) => x - y);
  const freq = [...freqMap].sort((x, y) => x[0] - y[0]);

  return {
    data,
    sorted: a,
    n,
    sum,
    mean,
    median,
    q1,
    q3,
    iqr: q3 - q1,
    min: a[0],
    max: a[n - 1],
    range: a[n - 1] - a[0],
    populationVariance,
    populationSd,
    sampleVariance,
    sampleSd,
    variance,
    sd,
    varianceConvention: sample ? 'sample (chia cho n − 1)' : 'population (chia cho n)',
    modes,
    freq,
  };
}

/** Equal-width histogram classes. Values at the maximum are kept in the last class. */
export function groupHistogramBins(data: number[], requestedBins: number): HistogramBin[] {
  if (!data.length || data.some(value => !Number.isFinite(value))) throw new Error('Histogram cần dãy số hữu hạn, không rỗng.');
  if (!Number.isInteger(requestedBins) || requestedBins < 2 || requestedBins > 20) throw new Error('Số lớp histogram phải là số nguyên từ 2 đến 20.');
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1, width = range / requestedBins;
  const bins = Array.from({ length: requestedBins }, (_, i) => ({ from: min + i * width, to: i === requestedBins - 1 ? max : min + (i + 1) * width, count: 0 }));
  for (const value of data) {
    const index = Math.max(0, Math.min(requestedBins - 1, Math.floor((value - min) / width)));
    bins[index].count++;
  }
  return bins;
}
