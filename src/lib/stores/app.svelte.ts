// src/lib/stores/app.svelte.ts
import { type DatasetResult, DatasetLoader } from '$lib/algorithms/loader';
import type { UMAPParams, WorkerResponseMessage } from '$lib/algorithms/umap.worker';
import UmapWorker from '$lib/algorithms/umap.worker?worker';
import { pcaInit } from '$lib/algorithms/pca';
import { hsl } from 'd3-color';

const loader = new DatasetLoader();

type CategoryInfo = {
	cluster_id: number;
	size: number;
	color: string;
};

type ProjectionHistoryEntry = {
	data: number[][];
	thumbnail: string;
	params: UMAPParams;
	steered?: boolean;
};

export class AppState {
	// ==========================================
	// 1. 基础数据与表格逻辑 (Data Table & Filtering)
	// ==========================================
	dataset = $state<DatasetResult | null>(null);
	dataMatrix = $state<number[][]>([]);
	dataSize = $state(0);
	usingRows = $state<number[]>([]);

	categoriesInfo = $state<Record<string, Record<string, CategoryInfo>>>({});
	continuousRange = $state<{ min: number; max: number } | null>(null);
	labelsOfSelectedCat = $state<string[]>([]);

	// ==========================================
	// 2. UMAP 参数与状态 (UMAP Parameters & Status)
	// ==========================================
	params = $state<UMAPParams>({
		nNeighbors: 15,
		minDist: 0.1,
		spread: 1.0,
		nEpochs: 500,
		nComponents: 2
	});

	initMethod = $state<'random' | 'pca' | 'spectral' | 'current'>('pca');
	isLocalDataset = $derived.by(() => this.dataset?.source === 'local');

	// 计算状态 (补全了这里)
	isCalculating = $state(false);
	isKnnDone = $state(false);
	currentEpoch = $state(0);
	totalEpochs = $state(500);
	private worker: Worker | null = null;
	private runSequence = 0;
	private activeRunId = 0;

	// ==========================================
	// 3. 投影历史与动画 (History & Morphing)
	// ==========================================
	history = $state<ProjectionHistoryEntry[]>([]);
	currentProjectionIdx = $state(-1);
	previousProjectionIdx = $state(-1);
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

		const t = this.animationProgress;
		const hasPrev = t < 1.0 && prev !== null && prev.length > 0;
		const labels = this.labelsOfSelectedCat;

		const result: { idx: number; x: number; y: number; cluster: string }[] = new Array(
			this.usingRows.length
		);
		for (let i = 0; i < this.usingRows.length; i++) {
			const actualIdx = this.usingRows[i];
			const point = curr[actualIdx];
			if (!point) continue;

			let x = point[0];
			let y = point[1];

			if (hasPrev && prev!.length > actualIdx) {
				const prevPoint = prev![actualIdx];
				if (prevPoint && prevPoint.length >= 2) {
					x = prevPoint[0] + (x - prevPoint[0]) * t;
					y = prevPoint[1] + (y - prevPoint[1]) * t;
				}
			}
			result[i] = { idx: actualIdx, x, y, cluster: labels[actualIdx] || '' };
		}
		return result;
	});

	// ==========================================
	// 4. 交互与高亮 (Interaction)
	// ==========================================
	selectedPointIdx = $state<number | null>(null);

	ifHighlightUnstablePoints = $state(false);

	unstablePointsIdx = $derived.by(() => {
		if (
			!this.ifHighlightUnstablePoints ||
			!this.currentProjectionData.length ||
			!this.previousProjectionData.length
		)
			return [];
		const unstablePoints: number[] = [];
		const threshold2 = 1.0; // squared Euclidean distance threshold (threshold=1.0 → threshold²=1.0)
		const currData = this.currentProjectionData;
		const prevData = this.previousProjectionData;
		const len = currData.length;
		for (let i = 0; i < len; i++) {
			const curr = currData[i];
			const prev = prevData[i];
			if (curr && prev) {
				const dx = curr[0] - prev[0];
				const dy = curr[1] - prev[1];
				if (dx * dx + dy * dy > threshold2) {
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

		const draggedLookup = Object.fromEntries(
			this.draggedPointsIdx.map((idx) => [idx, true] as const)
		);
		const clickedIsSelected = Boolean(draggedLookup[pointIdx]);

		if (clickedIsSelected) {
			// Remove cluster members from the selection
			const clusterLookup = Object.fromEntries(clusterPoints.map((idx) => [idx, true] as const));
			this.draggedPointsIdx = this.draggedPointsIdx.filter((idx) => !clusterLookup[idx]);
		} else {
			// Add cluster members not already in the selection (reuse draggedSet built above)
			const toAdd = clusterPoints.filter((idx) => !draggedLookup[idx]);
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
		this.worker.onmessage = (e: MessageEvent<WorkerResponseMessage>) => {
			const { type, runId } = e.data;
			if (runId !== this.activeRunId) return;

			if (type === 'KNN_DONE') {
				this.isKnnDone = true;
			} else if (type === 'UPDATE') {
				this.currentEpoch = e.data.epoch;
				this.isCalculating = true;
			} else if (type === 'FINISHED') {
				this.finishCalculation(e.data.embedding);
				this.isCalculating = false;
				this.currentEpoch = this.totalEpochs;
				this.activeRunId = 0;
			}
		};
	}

	private clearRunningState() {
		this.isCalculating = false;
		this.isKnnDone = false;
		this.currentEpoch = 0;
		this.realtimeEmbedding = null;
	}

	private cancelActiveRun() {
		if (this.activeRunId !== 0) {
			this.worker?.postMessage({ type: 'STOP', runId: this.activeRunId });
			this.activeRunId = 0;
		}
		this.clearRunningState();
	}

	// ==========================================
	// 6. 全局方法 (Actions)
	// ==========================================

	setDataset(result: DatasetResult) {
		this.dataset = result;
		this.dataMatrix = result.data;
		this.dataSize = result.data.length;
		this.usingRows = Array.from({ length: this.dataSize }, (_, i) => i);
		this.labelsOfSelectedCat = result.labels.map(String);
		this.setupCategories(result.labels, result.type);
		this.selectedPointIdx = null;
		this.draggedPointsIdx = [];

		// 停止正在运行的计算，防止旧结果污染新数据集的历史
		this.cancelActiveRun();

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
	async runUMAP() {
		if (!this.dataMatrix.length || !this.worker) return;

		this.cancelActiveRun();

		this.activeRunId = ++this.runSequence;
		this.isCalculating = true;
		this.totalEpochs = this.params.nEpochs;

		// 确定初始化位置
		let initPositions: number[][] | undefined;

		// 按用户选择的初始化方式
		switch (this.initMethod) {
			case 'spectral': {
				const nn = this.params.nNeighbors;
				const spectral = await loader.loadSpectralInit(this.dataset!.name, nn);
				if (spectral) {
					initPositions = spectral;
					console.log(
						`[UMAP] Spectral init (nn=${nn}→closest file): ${spectral.length} points ("${this.dataset!.name}")`
					);
				} else {
					const { embedding, timeMs } = pcaInit($state.snapshot(this.dataMatrix));
					initPositions = embedding;
					console.log(
						`[UMAP] Spectral init not found, PCA fallback: ${timeMs.toFixed(1)}ms ("${this.dataset!.name}")`
					);
				}
				break;
			}
			case 'pca': {
				const { embedding, timeMs } = pcaInit($state.snapshot(this.dataMatrix));
				initPositions = embedding;
				console.log(
					`[UMAP] PCA init: ${timeMs.toFixed(1)}ms, ${embedding.length} points ("${this.dataset!.name}")`
				);
				break;
			}
			case 'random':
				console.log(`[UMAP] Random init ("${this.dataset!.name}")`);
				break;
			case 'current': {
				if (this.currentProjectionIdx !== -1) {
					initPositions = $state.snapshot(this.currentProjectionData) as number[][];
					console.log(`[UMAP] Current embedding init ("${this.dataset!.name}")`);
				}
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
			runId: this.activeRunId,
			data: $state.snapshot(this.dataMatrix),
			params: $state.snapshot(this.params),
			initPositions
		});
	}

	/**
	 * 停止计算
	 */
	stop() {
		this.cancelActiveRun();
	}

	generateThumbnail(embedding: number[][]): string {
		if (typeof window === 'undefined' || !embedding.length) return '';
		const SIZE = 96,
			PAD = 3;
		const canvas = document.createElement('canvas');
		canvas.width = SIZE;
		canvas.height = SIZE;
		const ctx = canvas.getContext('2d');
		if (!ctx) return '';

		let minX = Infinity,
			maxX = -Infinity,
			minY = Infinity,
			maxY = -Infinity;
		for (let i = 0; i < embedding.length; i++) {
			const x = embedding[i][0],
				y = embedding[i][1];
			if (x < minX) minX = x;
			if (x > maxX) maxX = x;
			if (y < minY) minY = y;
			if (y > maxY) maxY = y;
		}
		const draw = SIZE - PAD * 2;
		const scale = draw / (Math.max(maxX - minX, maxY - minY) || 1);
		const catInfo = this.categoriesInfo['Label'] || {};

		// Pre-parse hex colors to integer RGB once per category (not per point)
		const rgbInt: Record<string, [number, number, number]> = {};
		for (const [label, info] of Object.entries(catInfo)) {
			const hex = (info.color || '#cccccc').replace('#', '');
			rgbInt[label] = [
				parseInt(hex.slice(0, 2), 16),
				parseInt(hex.slice(2, 4), 16),
				parseInt(hex.slice(4, 6), 16)
			];
		}
		const defaultRgb: [number, number, number] = [204, 204, 204];
		const labels = this.labelsOfSelectedCat;

		// Write pixels directly via ImageData — bypasses Canvas 2D path renderer entirely
		const imageData = ctx.createImageData(SIZE, SIZE);
		const data = imageData.data;
		// Fill white background (default is transparent/black)
		data.fill(255);

		for (let i = 0; i < embedding.length; i++) {
			const px = Math.round(PAD + (embedding[i][0] - minX) * scale);
			const py = Math.round(PAD + (maxY - embedding[i][1]) * scale); // Y flip
			if (px < 0 || px >= SIZE || py < 0 || py >= SIZE) continue;
			const label = String(labels[i] ?? '');
			const rgb = rgbInt[label] ?? defaultRgb;
			const base = (py * SIZE + px) * 4;
			data[base] = rgb[0];
			data[base + 1] = rgb[1];
			data[base + 2] = rgb[2];
			// data[base + 3] = 255; // already set by fill(255)
		}
		ctx.putImageData(imageData, 0, 0);
		return canvas.toDataURL('image/png');
	}

	selectHistoryEntry(idx: number) {
		if (idx === this.currentProjectionIdx) return;
		this.previousProjectionIdx = this.currentProjectionIdx;
		this.currentProjectionIdx = idx;
		this.animationProgress = 1.0;
	}

	commitDragAsNewHistory(draggedIndices: number[], dx: number, dy: number) {
		if (this.currentProjectionIdx === -1) return;
		const raw = $state.snapshot(this.history[this.currentProjectionIdx].data) as number[][];
		// Shallow-copy outer array; only create new inner arrays for dragged points (O(k) vs O(n))
		const newData = raw.slice();
		for (const idx of draggedIndices) {
			if (raw[idx]) {
				newData[idx] = [raw[idx][0] + dx, raw[idx][1] + dy];
			}
		}
		const thumbnail = this.generateThumbnail(newData);
		const params = $state.snapshot(this.history[this.currentProjectionIdx].params);
		this.previousProjectionIdx = this.currentProjectionIdx;
		this.history.push({ data: newData, thumbnail, params, steered: true });
		this.currentProjectionIdx = this.history.length - 1;
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

		console.log(
			`History updated. Curr: ${this.currentProjectionIdx}, Prev: ${this.previousProjectionIdx}`
		);
	}

	private setupCategories(labels: Array<string | number>, type: DatasetResult['type']) {
		const info: Record<string, CategoryInfo> = {};

		// Count occurrences in O(n)
		const counts: Record<string, number> = {};
		for (const label of labels) {
			const key = String(label);
			counts[key] = (counts[key] || 0) + 1;
		}

		if (type === 'continuous') {
			// Use loop instead of spread to avoid potential stack overflow on large datasets
			let minVal = Infinity,
				maxVal = -Infinity;
			for (const key of Object.keys(counts)) {
				const v = Number(key);
				if (v < minVal) minVal = v;
				if (v > maxVal) maxVal = v;
			}
			const range = maxVal - minVal || 1;
			this.continuousRange = { min: minVal, max: maxVal };

			for (const [labelStr, count] of Object.entries(counts)) {
				const t = (Number(labelStr) - minVal) / range; // 0 → 1
				// Blue (t=0, hue=240°) → Red (t=1, hue=0°)
				const color = hsl((1 - t) * 240, 0.85, 0.5);
				info[labelStr] = { cluster_id: 0, size: count, color: color.formatHex() };
			}
		} else {
			this.continuousRange = null;
			const colors = [
				'#1f77b4',
				'#ff7f0e',
				'#2ca02c',
				'#d62728',
				'#9467bd',
				'#8c564b',
				'#e377c2',
				'#7f7f7f',
				'#bcbd22',
				'#17becf'
			];
			let index = 0;
			for (const [labelStr, count] of Object.entries(counts)) {
				info[labelStr] = { cluster_id: index, size: count, color: colors[index % colors.length] };
				index++;
			}
		}

		this.categoriesInfo = { Label: info };
	}
}

export const appState = new AppState();
