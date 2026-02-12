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

	// 每次处理一小批 epoch，避免阻塞 Worker 消息队列太久
	const iterationsPerFrame = 50;
	
	for (let i = 0; i < iterationsPerFrame; i++) {
		if (currentEpoch >= totalEpochs) {
			isRunning = false;
			postMessage({ type: 'FINISHED', embedding: umap.getEmbedding() });
			return;
		}
		
		// 计算一步优化
		umap.step();
		currentEpoch++;
	}

	// 发送当前进度的坐标给主线程渲染
	postMessage({
		type: 'UPDATE',
		embedding: umap.getEmbedding(),
		epoch: currentEpoch,
		isFinished: false
	});

	// 通过 setTimeout 让出时间片，允许接收 'STOP' 消息
	setTimeout(runEpochs, 0); 
}