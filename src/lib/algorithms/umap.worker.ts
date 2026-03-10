import { UMAP } from 'umap-js';

// Message types used between the UI thread and the worker.
export type UMAPParams = {
	nNeighbors: number;
	minDist: number;
	nComponents: number; // Usually 2.
	nEpochs: number;
	spread?: number;
};

export type WorkerMessage =
	| {
			type: 'INIT';
			runId: number;
			data: number[][];
			params: UMAPParams;
			initPositions?: number[][];
	  }
	| { type: 'STOP'; runId: number }
	| { type: 'STEP' }; // Request a single execution batch.

export type WorkerResponseMessage =
	| { type: 'KNN_DONE'; runId: number }
	| { type: 'UPDATE'; runId: number; epoch: number }
	| { type: 'FINISHED'; runId: number; embedding: number[][] };

type UMAPEmbeddingHandle = {
	embedding: number[][];
};

let umap: UMAP | null = null;
let currentEpoch = 0;
let totalEpochs = 0;
let isRunning = false;
let iterationsPerBatch = 50; // Adjusted dynamically based on dataset size.
let activeRunId = 0;

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
	const msg = e.data;

	switch (msg.type) {
		case 'INIT':
			initUMAP(msg.runId, msg.data, msg.params, msg.initPositions);
			break;
		case 'STOP':
			if (msg.runId === activeRunId) {
				isRunning = false;
				activeRunId = 0;
				umap = null;
			}
			break;
		case 'STEP':
			if (isRunning && umap) {
				runEpochs(activeRunId);
			}
			break;
	}
};

function initUMAP(runId: number, data: number[][], params: UMAPParams, initPositions?: number[][]) {
	currentEpoch = 0;
	totalEpochs = params.nEpochs || 500;
	isRunning = true;
	activeRunId = runId;

	// Smaller datasets benefit from larger batches, while larger datasets need
	// shorter batches to keep the UI responsive.
	const n = data.length;
	iterationsPerBatch = n < 500 ? 200 : n < 2000 ? 100 : n < 10000 ? 50 : 20;

	// Instantiate UMAP. The exact option shape may vary slightly by umap-js version.
	umap = new UMAP({
		nNeighbors: params.nNeighbors,
		minDist: params.minDist,
		nComponents: params.nComponents,
		spread: params.spread || 1.0
	});

	umap.initializeFit(data);
	postMessage({ type: 'KNN_DONE', runId } satisfies WorkerResponseMessage);

	if (initPositions && initPositions.length > 0) {
		// Mutate the embedding in place instead of replacing the array reference.
		// umap-js updates coordinates through a shared embedding reference, so assigning
		// a new array here would disconnect optimization from getEmbedding().
		const embedding = (umap as unknown as UMAPEmbeddingHandle).embedding;
		const n = Math.min(embedding.length, initPositions.length);
		for (let i = 0; i < n; i++) {
			embedding[i][0] = initPositions[i][0];
			embedding[i][1] = initPositions[i][1];
		}
	}

	// Start batched execution.
	runEpochs(runId);
}

function runEpochs(runId: number) {
	if (!umap || !isRunning || runId !== activeRunId) return;

	for (let i = 0; i < iterationsPerBatch; i++) {
		if (runId !== activeRunId || !isRunning || !umap) return;

		if (currentEpoch >= totalEpochs) {
			isRunning = false;
			activeRunId = 0;
			postMessage({
				type: 'FINISHED',
				runId,
				embedding: umap.getEmbedding()
			} satisfies WorkerResponseMessage);
			umap = null;
			return;
		}

		umap.step();
		currentEpoch++;
	}

	// Rendering is still expensive, so only progress and final results are emitted.
	postMessage({
		type: 'UPDATE',
		runId,
		epoch: currentEpoch
	} satisfies WorkerResponseMessage);

	setTimeout(() => runEpochs(runId), 0);
}
