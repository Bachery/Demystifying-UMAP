// Lightweight PCA for UMAP initialization.
// Extracts top 2 principal components via power iteration + Gram-Schmidt,
// avoiding explicit covariance matrix construction (O(n*d) per iteration).

function dot(a: Float64Array | number[], b: Float64Array | number[]): number {
	let sum = 0;
	for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
	return sum;
}

function normalize(v: Float64Array): Float64Array {
	let n = 0;
	for (let i = 0; i < v.length; i++) n += v[i] * v[i];
	n = Math.sqrt(n);
	const out = new Float64Array(v.length);
	if (n === 0) {
		out.set(v);
		return out;
	}
	for (let i = 0; i < v.length; i++) out[i] = v[i] / n;
	return out;
}

/**
 * Computes (X^T X) v via two matrix-vector products.
 * Equivalent to multiplying by the covariance matrix but O(n*d) instead of O(d^2).
 */
function matvec(X: number[][], v: Float64Array | number[]): number[] {
	const n = X.length;
	const d = v.length;
	// u = X * v. A typed array avoids boxing overhead.
	const u = new Float64Array(n);
	for (let i = 0; i < n; i++) {
		let s = 0;
		const row = X[i];
		for (let j = 0; j < d; j++) s += row[j] * v[j];
		u[i] = s;
	}
	// result = X^T * u.
	const result = new Float64Array(d);
	for (let i = 0; i < n; i++) {
		const ui = u[i];
		const row = X[i];
		for (let j = 0; j < d; j++) result[j] += row[j] * ui;
	}
	return Array.from(result);
}

/**
 * Power iteration to find the dominant eigenvector of X^T X.
 * @param deflect If provided, the result is deflated to stay orthogonal to this vector.
 */
function powerIterate(X: number[][], deflect: Float64Array | null, iters = 100): Float64Array {
	const d = X[0].length;
	// Start from a uniform vector to keep initialization deterministic.
	const init = new Float64Array(d).fill(1);
	let v = normalize(init);

	for (let iter = 0; iter < iters; iter++) {
		const mv = matvec(X, v);
		// Convert the matvec result to a typed array before normalization.
		const mvTyped = new Float64Array(mv);
		v = normalize(mvTyped);
		if (deflect) {
			// Subtract the projection onto deflect for Gram-Schmidt orthogonalization.
			const proj = dot(v, deflect);
			const deflected = new Float64Array(d);
			for (let i = 0; i < d; i++) deflected[i] = v[i] - proj * deflect[i];
			v = normalize(deflected);
		}
	}
	return v;
}

/**
 * Compute a 2D PCA initialization of `data` suitable for UMAP.
 * @returns embedding n x 2 array of projected coordinates, scaled to [-10, 10]
 * @returns timeMs wall-clock time of the computation
 */
export function pcaInit(data: number[][]): { embedding: number[][]; timeMs: number } {
	const t0 = performance.now();

	const n = data.length;
	const d = data[0].length;

	// 1. Mean-center the data.
	const mean = new Array<number>(d).fill(0);
	for (const row of data) {
		for (let j = 0; j < d; j++) mean[j] += row[j];
	}
	for (let j = 0; j < d; j++) mean[j] /= n;

	const centered: number[][] = data.map((row) => row.map((v, j) => v - mean[j]));

	// 2. Estimate the top two principal components with power iteration.
	const pc1 = powerIterate(centered, null);
	const pc2 = powerIterate(centered, pc1);

	// 3. Project the data onto pc1 and pc2.
	const raw: number[][] = centered.map((row) => [dot(row, pc1), dot(row, pc2)]);

	// 4. Normalize to [-10, 10] to match the umap-js random initialization scale.
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
