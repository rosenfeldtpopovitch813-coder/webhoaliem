export type LinearSystemResult = {
  kind: 'unique' | 'infinite' | 'none';
  rref: number[][];
  pivotColumns: number[];
  freeColumns: number[];
  variables: number;
};

/** Gauss–Jordan solver for a numeric augmented matrix with any row count. */
export function solveAugmentedLinearSystem(matrix: number[][]): LinearSystemResult {
  if (!matrix.length || !matrix[0]?.length || matrix[0].length < 2) {
    throw new Error('Nhập ma trận mở rộng có ít nhất một ẩn và một cột hằng số.');
  }
  const width = matrix[0].length;
  if (matrix.some(row => row.length !== width || row.some(value => !Number.isFinite(value)))) {
    throw new Error('Ma trận mở rộng phải có số hữu hạn và tất cả các hàng cùng số cột.');
  }
  const variables = width - 1;
  if (variables > 8 || matrix.length > 12) {
    throw new Error('Bộ giải hỗ trợ tối đa 8 ẩn và 12 phương trình.');
  }

  const a = matrix.map(row => row.slice());
  const pivotColumns: number[] = [];
  let pivotRow = 0;
  const eps = 1e-10;

  for (let col = 0; col < variables && pivotRow < a.length; col++) {
    let best = pivotRow;
    for (let row = pivotRow + 1; row < a.length; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[best][col])) best = row;
    }
    if (Math.abs(a[best][col]) < eps) continue;
    [a[pivotRow], a[best]] = [a[best], a[pivotRow]];

    const pivot = a[pivotRow][col];
    for (let j = col; j < width; j++) a[pivotRow][j] /= pivot;
    for (let row = 0; row < a.length; row++) {
      if (row === pivotRow) continue;
      const factor = a[row][col];
      if (Math.abs(factor) < eps) {
        a[row][col] = 0;
        continue;
      }
      for (let j = col; j < width; j++) a[row][j] -= factor * a[pivotRow][j];
      a[row][col] = 0;
    }
    pivotColumns.push(col);
    pivotRow++;
  }

  for (const row of a) {
    const zeroCoefficients = row.slice(0, variables).every(value => Math.abs(value) < 1e-8);
    if (zeroCoefficients && Math.abs(row[variables]) >= 1e-8) {
      return { kind: 'none', rref: a, pivotColumns, freeColumns: [], variables };
    }
  }

  const freeColumns = Array.from({ length: variables }, (_, col) => col)
    .filter(col => !pivotColumns.includes(col));
  const kind = freeColumns.length ? 'infinite' : 'unique';
  return { kind, rref: a, pivotColumns, freeColumns, variables };
}
