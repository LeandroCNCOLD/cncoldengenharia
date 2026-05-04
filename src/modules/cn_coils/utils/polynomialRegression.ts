/**
 * Regressão polinomial por mínimos quadrados.
 * Retorna coeficientes [a0, a1, a2, ..., an] onde:
 *   y = a0 + a1*x + a2*x² + ... + an*xⁿ
 */
export function polynomialRegression(
  xs: number[],
  ys: number[],
  degree: number,
): { coefficients: number[]; rSquared: number } {
  const n = xs.length;
  if (n < degree + 1) {
    throw new Error("Pontos insuficientes para o grau solicitado");
  }

  const A: number[][] = xs.map((x) =>
    Array.from({ length: degree + 1 }, (_, k) => Math.pow(x, k)),
  );
  const AT = transpose(A);
  const ATA = matMul(AT, A);
  const ATy = matVecMul(AT, ys);
  const coefficients = gaussianElimination(ATA, ATy);

  const yMean = ys.reduce((sum, value) => sum + value, 0) / n;
  const ssTot = ys.reduce((sum, value) => sum + (value - yMean) ** 2, 0);
  const ssRes = xs.reduce((sum, x, index) => {
    const yHat = coefficients.reduce(
      (total, coefficient, power) => total + coefficient * Math.pow(x, power),
      0,
    );
    return sum + (ys[index] - yHat) ** 2;
  }, 0);
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 1;

  return { coefficients, rSquared };
}

function transpose(matrix: number[][]): number[][] {
  return matrix[0].map((_, index) => matrix.map((row) => row[index]));
}

function matMul(A: number[][], B: number[][]): number[][] {
  return A.map((row) =>
    B[0].map((_, column) =>
      row.reduce((sum, value, index) => sum + value * B[index][column], 0),
    ),
  );
}

function matVecMul(A: number[][], vector: number[]): number[] {
  return A.map((row) =>
    row.reduce((sum, value, index) => sum + value * vector[index], 0),
  );
}

function gaussianElimination(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, index) => [...row, b[index]]);

  for (let column = 0; column < n; column++) {
    let maxRow = column;
    for (let row = column + 1; row < n; row++) {
      if (Math.abs(M[row][column]) > Math.abs(M[maxRow][column])) {
        maxRow = row;
      }
    }
    [M[column], M[maxRow]] = [M[maxRow], M[column]];

    if (Math.abs(M[column][column]) < 1e-12) {
      throw new Error("Sistema singular na regressão polinomial");
    }

    for (let row = column + 1; row < n; row++) {
      const factor = M[row][column] / M[column][column];
      for (let k = column; k <= n; k++) {
        M[row][k] -= factor * M[column][k];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let rhs = M[i][n];
    for (let k = i + 1; k < n; k++) {
      rhs -= M[i][k] * x[k];
    }
    x[i] = rhs / M[i][i];
  }
  return x;
}

export function formatPolynomial(
  coefficients: number[],
  varName: string,
  unit: string,
  precision = 4,
): string {
  const equation = coefficients
    .map((coefficient, power) => {
      const sign = power === 0 ? (coefficient < 0 ? "-" : "") : coefficient >= 0 ? " + " : " − ";
      const value = Math.abs(coefficient).toFixed(precision);
      if (power === 0) return `${sign}${value}`;
      if (power === 1) return `${sign}${value}·${varName}`;
      return `${sign}${value}·${varName}${superscript(power)}`;
    })
    .join("");

  return `Q(${varName}) = ${equation}  [${unit}]`;
}

export function superscript(n: number): string {
  const map: Record<string, string> = {
    "0": "⁰",
    "1": "¹",
    "2": "²",
    "3": "³",
    "4": "⁴",
    "5": "⁵",
    "6": "⁶",
    "7": "⁷",
    "8": "⁸",
    "9": "⁹",
  };
  return String(n)
    .split("")
    .map((digit) => map[digit] ?? digit)
    .join("");
}

export function formatPolynomialExcel(coefficients: number[], cellRef = "A1"): string {
  return (
    "=" +
    coefficients
      .map((coefficient, power) => {
        if (power === 0) return coefficient.toFixed(6);
        const sign = coefficient >= 0 ? "+" : "";
        if (power === 1) return `${sign}${coefficient.toFixed(6)}*${cellRef}`;
        return `${sign}${coefficient.toFixed(6)}*${cellRef}^${power}`;
      })
      .join("")
  );
}
