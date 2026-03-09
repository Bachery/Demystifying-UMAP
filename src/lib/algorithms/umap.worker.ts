// src/lib/algorithms/umap.worker.ts
import { UMAP } from 'umap-js';

// 定义消息类型，确保类型安全
export type UMAPParams = {
	nNeighbors: number;
	minDist: number;
	nComponents: number; // 通常是 2
	nEpochs: number;
	spread?: number;
};

export type WorkerMessage = 
	| { type: 'INIT'; data: number[][]; params: UMAPParams; initPositions?: number[][] }
	| { type: 'STOP' }
	| { type: 'STEP' }; // 请求跑一步

let umap: UMAP | null = null;
let currentEpoch = 0;
let totalEpochs = 0;
let isRunning = false;
let iterationsPerBatch = 50; // dynamically set based on data size

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
	const msg = e.data;

	switch (msg.type) {
		case 'INIT':
			initUMAP(msg.data, msg.params, msg.initPositions);
			break;
		case 'STOP':
			isRunning = false;
			break;
		case 'STEP':
			if (isRunning && umap) {
				runEpochs();
			}
			break;
	}
};

function initUMAP(data: number[][], params: UMAPParams, initPositions?: number[][]) {
	currentEpoch = 0;
	totalEpochs = params.nEpochs || 500;
	isRunning = true;

	// Adaptive batch size: smaller datasets benefit from larger batches (less setTimeout overhead),
	// larger datasets need smaller batches to keep the UI responsive.
	const n = data.length;
	iterationsPerBatch = n < 500 ? 200 : n < 2000 ? 100 : n < 10000 ? 50 : 20;

	// 实例化 UMAP
	// 注意：umap-js 的 API 可能需要根据版本微调，但通常如下
	umap = new UMAP({
		nNeighbors: params.nNeighbors,
		minDist: params.minDist,
		nComponents: params.nComponents,
		spread: params.spread || 1.0,
	});

	umap.initializeFit(data);
	postMessage({ type: 'KNN_DONE' });

	if (initPositions && initPositions.length > 0) {
		// 必须原地修改 embedding，不能替换引用。
		// umap-js 的 optimizationState.headEmbedding 与 this.embedding 是同一引用，
		// step() 通过 headEmbedding 就地更新坐标。直接赋值 umap.embedding = newArray
		// 会断开该引用，导致 step() 在旧随机初始化上优化而 getEmbedding() 永远返回
		// 未被优化的初始值。
		const embedding = (umap as any).embedding as number[][];
		const n = Math.min(embedding.length, initPositions.length);
		for (let i = 0; i < n; i++) {
			embedding[i][0] = initPositions[i][0];
			embedding[i][1] = initPositions[i][1];
		}
	}
	
	// 开始循环
	runEpochs();
}

function runEpochs() {
	if (!umap || !isRunning) return;

	for (let i = 0; i < iterationsPerBatch; i++) {
		if (currentEpoch >= totalEpochs) {
			isRunning = false;
			postMessage({ type: 'FINISHED', embedding: umap.getEmbedding() });
			return;
		}
		
		umap.step();
		currentEpoch++;
	}

	// 渲染还是很吃时间，不发中间结果，只发初始化和最终结果
	postMessage({
		type: 'UPDATE',
		// embedding: umap.getEmbedding(),
		epoch: currentEpoch,
		isFinished: false
	});

	setTimeout(runEpochs, 0); 
}