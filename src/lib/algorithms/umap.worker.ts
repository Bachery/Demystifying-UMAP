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
	// 如果有 Steering 传进来的 initPositions，直接用；否则让 UMAP 自己初始化
	if (initPositions && initPositions.length > 0) {
		// UMAP-js 允许传入初始 embedding
		// 这一步比较关键，用于 Steering
		umap.setPrecomputedKNN(null); // 清理旧的
		umap.initializeFit(data);     // 先初始化内部结构
		umap.embedding = JSON.parse(JSON.stringify(initPositions)); // 强制覆盖 embedding
	} else {
		// 标准初始化
		umap.initializeFit(data);
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