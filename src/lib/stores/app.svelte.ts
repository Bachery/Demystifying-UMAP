// src/lib/stores/app.svelte.ts
import { type DatasetResult, DatasetLoader } from '$lib/algorithms/loader';
import type { UMAPParams } from '$lib/algorithms/umap.worker';
import UmapWorker from '$lib/algorithms/umap.worker?worker';
import { pcaInit } from '$lib/algorithms/pca';
import { hsl } from 'd3-color';

const loader = new DatasetLoader();

export class AppState {
	// ==========================================
	// 1. 基础数据与表格逻辑 (Data Table & Filtering)
	// ==========================================
	dataset = $state<DatasetResult | null>(null); // 补上了这个
	dataMatrix = $state<number[][]>([]);
	dataSize = $state(0);
	usingRows = $state<number[]>([]);

	// 列选择逻辑 (为未来用户上传数据预留)
	numericalColumns = $state<string[]>([]);
	categoricalColumns = $state<string[]>([]);
	selectedNumColumns = $state<string[]>([]);
	selectedCatColumn = $state<string>('');
	categoriesInfo = $state<Record<string, any>>({});
	continuousRange = $state<{ min: number; max: number } | null>(null);
	labelsOfSelectedCat = $state<string[]>([]); 

	// Derived: 获取选中的数值列的 Index
	selectedNumColumnsIdx = $derived.by(() => {
		if (!this.numericalColumns.length || !this.selectedNumColumns.length) return [];
		return this.selectedNumColumns.map(col => this.numericalColumns.indexOf(col));
	});

	// ==========================================
	// 2. UMAP 参数与状态 (UMAP Parameters & Status)
	// ==========================================
	params = $state<UMAPParams>({
		nNeighbors: 15, // 注意这里字段名要跟 Worker 里定义的一致
		minDist: 0.1,
		spread: 1.0,
		nEpochs: 500,
		nComponents: 2
	});

	initMethod = $state<'random' | 'pca' | 'spectral'>('pca');
	isLocalDataset = $derived.by(() => this.dataset?.source === 'local');

	// 计算状态 (补全了这里)
	isCalculating = $state(false);
	currentEpoch = $state(0);
	totalEpochs = $state(500);
	private worker: Worker | null = null;

	// ==========================================
	// 3. 投影历史与动画 (History & Morphing)
	// ==========================================
	history = $state<Array<{ data: number[][], thumbnail: string, params: any }>>([]);
	currentProjectionIdx = $state(-1);
	previousProjectionIdx = $state(-1);
	changePreviousIdx = $state(true);
	animationProgress = $state(1.0);
	realtimeEmbedding = $state<number[][] | null>(null);

	currentProjectionData = $derived.by(() => {
		if (this.realtimeEmbedding) return this.realtimeEmbedding;
		if (this.history.length === 0 || this.currentProjectionIdx === -1) return [];
		return this.history[this.currentProjectionIdx].data;
	});

	previousProjectionData = $derived.by(() => {
		if (this.history.length === 0 || this.previousProjectionIdx === -1) return [];
		return this.history[this.previousProjectionIdx].data;
	});

	pointsToRender = $derived.by(() => {
		const curr = this.currentProjectionData;
		const prev = this.previousProjectionData;

		// 增加安全检查：如果为空，直接返回
		if (!curr || curr.length === 0 || !this.usingRows || this.usingRows.length === 0) return [];

		const usingSet = new Set(this.usingRows);
		return curr
			.filter((_, idx) => usingSet.has(idx))
			.map((point, i) => {
				const actualIdx = this.usingRows[i];
				const cluster = this.labelsOfSelectedCat[actualIdx] || '';

				let x = point[0];
				let y = point[1];

				// 增加对 prev 和 prev[actualIdx] 的绝对安全检查
				if (this.animationProgress < 1.0 && prev && prev.length > actualIdx) {
					const prevPoint = prev[actualIdx];
					if (prevPoint && prevPoint.length >= 2) {
						x = prevPoint[0] + (x - prevPoint[0]) * this.animationProgress;
						y = prevPoint[1] + (y - prevPoint[1]) * this.animationProgress;
					}
				}
				return { idx: actualIdx, x, y, cluster };
			});
	});

	// ==========================================
	// 4. 交互与高亮 (Interaction)
	// ==========================================
	selectedPointIdx = $state<number | null>(null);
	graphEdges = $state<Record<string, number[]>>({}); 
	
	targetPointsIdx = $derived.by(() => {
		if (this.selectedPointIdx === null) return [];
		return this.graphEdges[String(this.selectedPointIdx)] || [];
	});

	ifHighlightUnstablePoints = $state(false);
	
	unstablePointsIdx = $derived.by(() => {
		if (!this.ifHighlightUnstablePoints || !this.currentProjectionData.length || !this.previousProjectionData.length) return [];
		const unstablePoints: number[] = [];
		const threshold = 1.0; 
		for (let i = 0; i < this.currentProjectionData.length; i++) {
			const curr = this.currentProjectionData[i];
			const prev = this.previousProjectionData[i];
			if (curr && prev) {
				if (Math.abs(curr[0]-prev[0]) > threshold || Math.abs(curr[1]-prev[1]) > threshold) {
					unstablePoints.push(i);
				}
			}
		}
		return unstablePoints;
	});

	manualMode = $state(false);
	draggedPointsIdx = $state<number[]>([]);

	/**
	 * Toggle the entire cluster of the clicked point into/out of draggedPointsIdx.
	 * - If clicked point IS in draggedPointsIdx: remove all cluster members that are in the array.
	 * - If clicked point is NOT in draggedPointsIdx: add all cluster members not already in the array.
	 */
	toggleClusterSelection(pointIdx: number) {
		const label = String(this.labelsOfSelectedCat[pointIdx] ?? '');
		if (!label) return;

		// All points (within usingRows) that share the same cluster label
		const clusterPoints = this.usingRows.filter(
			(idx) => String(this.labelsOfSelectedCat[idx] ?? '') === label
		);

		const clickedIsSelected = this.draggedPointsIdx.includes(pointIdx);

		if (clickedIsSelected) {
			// Remove cluster members from the selection
			const clusterSet = new Set(clusterPoints);
			this.draggedPointsIdx = this.draggedPointsIdx.filter((idx) => !clusterSet.has(idx));
		} else {
			// Add cluster members not already in the selection
			const existingSet = new Set(this.draggedPointsIdx);
			const toAdd = clusterPoints.filter((idx) => !existingSet.has(idx));
			this.draggedPointsIdx = [...this.draggedPointsIdx, ...toAdd];
		}
	}

	// ==========================================
	// 5. 初始化与构造
	// ==========================================
	constructor() {
		this.initWorker();
	}

	private initWorker() {
		if (typeof window === 'undefined') return;

		this.worker = new UmapWorker();
		this.worker.onmessage = (e) => {
			const { type, embedding, epoch } = e.data;
			
			if (type === 'UPDATE') {
				// 计算中：实时更新最新的 embedding，但不存入 history
				this.updateCurrentProjectionRealtime(embedding);
				this.currentEpoch = epoch;
				this.isCalculating = true;
			} else if (type === 'FINISHED') {
				// 计算完成：正式存入 History
				this.finishCalculation(embedding);
				this.isCalculating = false;
				this.currentEpoch = this.totalEpochs;
			}
		};
	}

	// ==========================================
	// 6. 全局方法 (Actions)
	// ==========================================

	setDataset(result: any) {
		this.dataset = result; // 记录原始 DatasetResult
		this.dataMatrix = result.data;
		this.dataSize = result.data.length;
		this.usingRows = Array.from({ length: this.dataSize }, (_, i) => i);
		this.categoricalColumns = ['Label'];
		this.selectedCatColumn = 'Label';
		this.labelsOfSelectedCat = result.labels.map(String);
		this.setupCategories(result.labels, result.type);
		
		// 停止正在运行的计算，防止旧结果污染新数据集的历史
		this.worker?.postMessage({ type: 'STOP' });
		this.isCalculating = false;
		this.realtimeEmbedding = null;

		// 重置历史
		this.history = [];
		this.currentProjectionIdx = -1;
		this.previousProjectionIdx = -1;
		this.animationProgress = 1.0;

		// 根据数据来源设置默认初始化方式
		this.initMethod = result.source === 'local' ? 'spectral' : 'pca';
	}

	/**
	 * 核心计算方法
	 * 若未传入 manualInit，则尝试加载对应数据集的 spectral 初始化文件；
	 * 文件不存在时回退到 umap-js 默认初始化。
	 */
	async runUMAP(manualInit?: number[][]) {
		if (!this.dataMatrix.length || !this.worker) return;

		// 停止之前的
		this.worker.postMessage({ type: 'STOP' });

		this.isCalculating = true;
		this.currentEpoch = 0;
		this.totalEpochs = this.params.nEpochs;

		// 确定初始化位置
		let initPositions: number[][] | undefined;

		if (manualInit) {
			// 手动拖拽模式：使用当前 embedding 作为初始化
			initPositions = $state.snapshot(manualInit);
		} else {
			// 按用户选择的初始化方式
			switch (this.initMethod) {
				case 'spectral': {
					const nn = this.params.nNeighbors;
					const spectral = await loader.loadSpectralInit(this.dataset!.name, nn);
					if (spectral) {
						initPositions = spectral;
						console.log(`[UMAP] Spectral init (nn=${nn}→closest file): ${spectral.length} points ("${this.dataset!.name}")`);
					} else {
						// 文件不存在时回退到 PCA
						const { embedding, timeMs } = pcaInit($state.snapshot(this.dataMatrix));
						initPositions = embedding;
						console.log(`[UMAP] Spectral init not found, PCA fallback: ${timeMs.toFixed(1)}ms ("${this.dataset!.name}")`);
					}
					break;
				}
				case 'pca': {
					const { embedding, timeMs } = pcaInit($state.snapshot(this.dataMatrix));
					initPositions = embedding;
					console.log(`[UMAP] PCA init: ${timeMs.toFixed(1)}ms, ${embedding.length} points ("${this.dataset!.name}")`);
					break;
				}
				case 'random':
					console.log(`[UMAP] Random init ("${this.dataset!.name}")`);
					break;
			}
		}

		// 初始化位置确定后，立即渲染到 2D 画布
		if (initPositions) {
			this.realtimeEmbedding = initPositions;
		}

		// 发送给 Worker
		this.worker.postMessage({
			type: 'INIT',
			data: $state.snapshot(this.dataMatrix),
			params: $state.snapshot(this.params),
			initPositions
		});
	}

	/**
	 * 停止计算
	 */
	stop() {
		this.worker?.postMessage({ type: 'STOP' });
		this.isCalculating = false;
	}

	private updateCurrentProjectionRealtime(embedding: number[][]) {
		if (!embedding) return;
		this.realtimeEmbedding = embedding;
	}

	private generateThumbnail(embedding: number[][]): string {
		if (typeof window === 'undefined' || !embedding.length) return '';
		const SIZE = 48, PAD = 3;
		const canvas = document.createElement('canvas');
		canvas.width = SIZE; canvas.height = SIZE;
		const ctx = canvas.getContext('2d');
		if (!ctx) return '';

		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, SIZE, SIZE);

		let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
		for (const [x, y] of embedding) {
			if (x < minX) minX = x; if (x > maxX) maxX = x;
			if (y < minY) minY = y; if (y > maxY) maxY = y;
		}
		const draw = SIZE - PAD * 2;
		const scale = draw / (Math.max(maxX - minX, maxY - minY) || 1);
		const catInfo = this.categoriesInfo['Label'] || {};

		for (let i = 0; i < embedding.length; i++) {
			const [x, y] = embedding[i];
			const px = PAD + (x - minX) * scale;
			const py = PAD + (maxY - y) * scale; // Y flip
			const label = String(this.labelsOfSelectedCat[i] ?? '');
			ctx.fillStyle = catInfo[label]?.color ?? '#cccccc';
			ctx.beginPath();
			ctx.arc(px, py, 1.2, 0, Math.PI * 2);
			ctx.fill();
		}
		return canvas.toDataURL('image/png');
	}

	selectHistoryEntry(idx: number) {
		if (idx === this.currentProjectionIdx) return;
		this.previousProjectionIdx = this.currentProjectionIdx;
		this.currentProjectionIdx = idx;
		this.animationProgress = 1.0;
	}

	private finishCalculation(embedding: number[][]) {
		const thumbnail = this.generateThumbnail(embedding);

		// 1. 清除实时 embedding，正式存入 history
		this.realtimeEmbedding = null;

		const snapshotParams = $state.snapshot(this.params);
		const newRecord = {
			data: embedding,
			thumbnail,
			params: snapshotParams
		};
		this.history.push(newRecord);

		// 2. 更新指针：Previous 变为原来的 Current，Current 指向最新
		if (this.currentProjectionIdx !== -1) {
			this.previousProjectionIdx = this.currentProjectionIdx;
		}
		this.currentProjectionIdx = this.history.length - 1;

		// 3. 始终显示最新结果（animationProgress=1.0）
		// MorphControl 滑条可让用户手动回看 Previous
		this.animationProgress = 1.0;

		console.log(`History updated. Curr: ${this.currentProjectionIdx}, Prev: ${this.previousProjectionIdx}`);
	}

	private setupCategories(labels: any[], type: string) {
		const info: Record<string, any> = {};

		// Count occurrences in O(n)
		const countMap = new Map<string, number>();
		for (const label of labels) {
			const key = String(label);
			countMap.set(key, (countMap.get(key) || 0) + 1);
		}

		if (type === 'continuous') {
			const numericValues = [...countMap.keys()].map(Number);
			const minVal = Math.min(...numericValues);
			const maxVal = Math.max(...numericValues);
			const range = maxVal - minVal || 1;
			this.continuousRange = { min: minVal, max: maxVal };

			for (const [labelStr, count] of countMap) {
				const t = (Number(labelStr) - minVal) / range; // 0 → 1
				// Blue (t=0, hue=240°) → Red (t=1, hue=0°)
				const color = hsl((1 - t) * 240, 0.85, 0.5);
				info[labelStr] = { cluster_id: 0, size: count, color: color.formatHex() };
			}
		} else {
			this.continuousRange = null;
			const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];
			let index = 0;
			for (const [labelStr, count] of countMap) {
				info[labelStr] = { cluster_id: index, size: count, color: colors[index % colors.length] };
				index++;
			}
		}

		this.categoriesInfo = { 'Label': info };
	}
}

export const appState = new AppState();