// src/lib/algorithms/pca.ts
// Lightweight PCA for UMAP initialization.
// Extracts top 2 principal components via power iteration + Gram-Schmidt,
// avoiding explicit covariance matrix construction (O(n*d) per iteration).

function dot(a: number[], b: number[]): number {
	let sum = 0;
	for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
	return sum;
}

function normalize(v: number[]): number[] {
	let n = 0;
	for (const x of v) n += x * x;
	n = Math.sqrt(n);
	return n === 0 ? v.slice() : v.map((x) => x / n);
}

/**
 * Computes (X^T X) v via two matrix-vector products.
 * Equivalent to multiplying by the covariance matrix but O(n*d) instead of O(d^2).
 */
function matvec(X: number[][], v: number[]): number[] {
	const n = X.length;
	const d = v.length;
	// u = X * v  (n-vector)
	const u = new Array<number>(n);
	for (let i = 0; i < n; i++) {
		let s = 0;
		const row = X[i];
		for (let j = 0; j < d; j++) s += row[j] * v[j];
		u[i] = s;
	}
	// result = X^T * u  (d-vector)
	const result = new Array<number>(d).fill(0);
	for (let i = 0; i < n; i++) {
		const ui = u[i];
		const row = X[i];
		for (let j = 0; j < d; j++) result[j] += row[j] * ui;
	}
	return result;
}

/**
 * Power iteration to find the dominant eigenvector of X^T X.
 * @param deflect  If provided, the result is deflated to be orthogonal to this vector (Gram-Schmidt).
 */
function powerIterate(X: number[][], deflect: number[] | null, iters = 100): number[] {
	const d = X[0].length;
	// Deterministic start: uniform vector
	let v = normalize(new Array<number>(d).fill(1));

	for (let iter = 0; iter < iters; iter++) {
		v = normalize(matvec(X, v));
		if (deflect) {
			// Subtract projection onto deflect (Gram-Schmidt orthogonalization)
			const proj = dot(v, deflect);
			v = normalize(v.map((x, i) => x - proj * deflect[i]));
		}
	}
	return v;
}

/**
 * Compute a 2D PCA initialization of `data` suitable for UMAP.
 * @returns embedding  n×2 array of projected coordinates, scaled to [-10, 10]
 * @returns timeMs     wall-clock time of the computation
 */
export function pcaInit(data: number[][]): { embedding: number[][]; timeMs: number } {
	const t0 = performance.now();

	const n = data.length;
	const d = data[0].length;

	// 1. Mean-center the data
	const mean = new Array<number>(d).fill(0);
	for (const row of data) {
		for (let j = 0; j < d; j++) mean[j] += row[j];
	}
	for (let j = 0; j < d; j++) mean[j] /= n;

	const centered: number[][] = data.map((row) => row.map((v, j) => v - mean[j]));

	// 2. Top 2 principal components via power iteration
	const pc1 = powerIterate(centered, null);
	const pc2 = powerIterate(centered, pc1);

	// 3. Project data onto pc1, pc2
	const raw: number[][] = centered.map((row) => [dot(row, pc1), dot(row, pc2)]);

	// 4. Normalize to [-10, 10] (matches umap-js random init scale)
	let maxAbs = 0;
	for (const [x, y] of raw) {
		if (Math.abs(x) > maxAbs) maxAbs = Math.abs(x);
		if (Math.abs(y) > maxAbs) maxAbs = Math.abs(y);
	}
	const scale = maxAbs > 0 ? 10 / maxAbs : 1;
	const embedding = raw.map(([x, y]) => [x * scale, y * scale]);

	const timeMs = performance.now() - t0;
	return { embedding, timeMs };
}
