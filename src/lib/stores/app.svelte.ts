// src/lib/stores/app.svelte.ts
import { type DatasetResult } from '$lib/algorithms/loader';
import type { UMAPParams } from '$lib/algorithms/umap.worker';

// 导入 Worker 类 (Vite 会自动处理这种导入)
import UmapWorker from '$lib/algorithms/umap.worker?worker';

class AppState {
	// === 核心状态 (Svelte 5 Runes) ===
	dataset = $state<DatasetResult | null>(null);
	embedding = $state<number[][]>([]); // 2D 坐标
	
	// UI 状态
	isCalculating = $state(false);
	currentEpoch = $state(0);
	totalEpochs = $state(500);
	
	// 参数
	params = $state<UMAPParams>({
		nNeighbors: 15,
		minDist: 0.1,
		nComponents: 2,
		nEpochs: 400,
		spread: 1.0
	});

	// Worker 实例
	private worker: Worker | null = null;

	constructor() {
		this.initWorker();
	}

	private initWorker() {
		if (typeof window === 'undefined') return; // 防止 SSR 报错

		this.worker = new UmapWorker();
		
		this.worker.onmessage = (e) => {
			const { type, embedding, epoch } = e.data;
			
			if (type === 'UPDATE') {
				this.embedding = embedding; // 更新坐标，触发 UI 重绘
				this.currentEpoch = epoch;
				this.isCalculating = true;
			} else if (type === 'FINISHED') {
				this.embedding = embedding;
				this.isCalculating = false;
				this.currentEpoch = this.totalEpochs;
			}
		};
	}

	/**
	 * 加载新数据集
	 */
	setDataset(newDataset: DatasetResult) {
		this.dataset = newDataset;
		this.embedding = []; // 清空旧图
		this.runUMAP();      // 自动开始计算
	}

	/**
	 * 运行 UMAP (或重新运行)
	 * @param manualInit (可选) 用于 Steering，传入用户修改后的 2D 坐标作为起点
	 */
	runUMAP(manualInit?: number[][]) {
		if (!this.dataset || !this.worker) return;

		// 停止之前的计算
		this.worker.postMessage({ type: 'STOP' });

		this.isCalculating = true;
		this.currentEpoch = 0;
		this.totalEpochs = this.params.nEpochs;

		// 发送初始化消息
		this.worker.postMessage({
			type: 'INIT',
			data: this.dataset.data, // 3D 原始数据
			params: $state.snapshot(this.params), // 去除 Proxy 包装
			initPositions: manualInit ? $state.snapshot(manualInit) : undefined
		});
	}

	/**
	 * 停止计算
	 */
	stop() {
		this.worker?.postMessage({ type: 'STOP' });
		this.isCalculating = false;
	}
	
	/**
	 * 更新参数
	 */
	updateParams(newParams: Partial<UMAPParams>) {
		Object.assign(this.params, newParams);
		// 参数变了，通常需要重新跑
		if (this.dataset) {
			this.runUMAP();
		}
	}
}

// 导出单例
export const appState = new AppState();