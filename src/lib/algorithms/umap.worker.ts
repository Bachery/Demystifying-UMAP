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

	// 实例化 UMAP
	// 注意：umap-js 的 API 可能需要根据版本微调，但通常如下
	umap = new UMAP({
		nNeighbors: params.nNeighbors,
		minDist: params.minDist,
		nComponents: params.nComponents,
		spread: params.spread || 1.0,
	});

	// 1. 同步初始化 (Fit) 部分
	// 先让 umap-js 完整初始化（计算 kNN、建立优化状态），再原地覆盖 embedding 值
	umap.initializeFit(data);

	if (initPositions && initPositions.length > 0) {
		// 关键：必须原地修改 embedding，不能替换引用！
		// 原因：umap-js 内部 optimizationState.headEmbedding 在 initializeFit 后与
		// this.embedding 指向同一个对象引用。step() 通过 headEmbedding 就地修改坐标。
		// 如果直接赋值 umap.embedding = newArray，只更新了 getEmbedding() 返回的引用，
		// headEmbedding 仍指向旧的随机初始化数组，导致优化在错误的数组上进行，
		// 而 getEmbedding() 永远返回未被优化的 spectral init 值（冻结BUG）。
		const embedding = (umap as any).embedding as number[][];
		const n = Math.min(embedding.length, initPositions.length);
		for (let i = 0; i < n; i++) {
			embedding[i][0] = initPositions[i][0];
			embedding[i][1] = initPositions[i][1];
		}
		console.log('[Worker] Spectral init applied in-place, embedding[0]:', embedding[0]);
	}
	
	// 发送初始状态回主线程
	postMessage({
		type: 'UPDATE',
		embedding: umap.getEmbedding(),
		epoch: 0,
		isFinished: false
	});

	// 开始循环
	runEpochs();
}

function runEpochs() {
	if (!umap || !isRunning) return;

	// [修改] 从 5 改为 50，大幅减少主线程的渲染压力
	const iterationsPerBatch = 50; 
	
	for (let i = 0; i < iterationsPerBatch; i++) {
		if (currentEpoch >= totalEpochs) {
			isRunning = false;
			postMessage({ type: 'FINISHED', embedding: umap.getEmbedding() });
			return;
		}
		
		umap.step();
		currentEpoch++;
	}

	// 恢复发送 embedding，因为我们后面优化了渲染逻辑，现在不怕卡了
	postMessage({
		type: 'UPDATE',
		embedding: umap.getEmbedding(),
		epoch: currentEpoch,
		isFinished: false
	});

	setTimeout(runEpochs, 0); 
}