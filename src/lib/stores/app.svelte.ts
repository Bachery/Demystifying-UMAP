// src/lib/stores/app.svelte.ts
import { type DatasetResult } from '$lib/algorithms/loader';
import type { UMAPParams } from '$lib/algorithms/umap.worker';
import UmapWorker from '$lib/algorithms/umap.worker?worker';

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

	currentProjectionData = $derived.by(() => {
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
		if (!curr.length || !this.usingRows.length) return [];

		return curr
			.filter((_, idx) => this.usingRows.includes(idx))
			.map((point, i) => {
				const actualIdx = this.usingRows[i];
				const cluster = this.labelsOfSelectedCat[actualIdx] || '';
				
				if (this.animationProgress < 1.0 && prev.length) {
					const prevPoint = prev[actualIdx];
					if (prevPoint) {
						return {
							idx: actualIdx,
							x: prevPoint[0] + (point[0] - prevPoint[0]) * this.animationProgress,
							y: prevPoint[1] + (point[1] - prevPoint[1]) * this.animationProgress,
							cluster
						};
					}
				}
				return { idx: actualIdx, x: point[0], y: point[1], cluster };
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
		
		// 重置历史
		this.history = [];
		this.currentProjectionIdx = -1;
		this.previousProjectionIdx = -1;
		this.animationProgress = 1.0;
		
		// 自动开始第一次计算
		this.runUMAP();
	}

	/**
	 * 核心计算方法
	 */
	runUMAP(manualInit?: number[][]) {
		if (!this.dataMatrix.length || !this.worker) return;

		// 停止之前的
		this.worker.postMessage({ type: 'STOP' });

		this.isCalculating = true;
		this.currentEpoch = 0;
		this.totalEpochs = this.params.nEpochs; // 更新进度条上限

		// 发送给 Worker
		this.worker.postMessage({
			type: 'INIT',
			data: $state.snapshot(this.dataMatrix), // 传原始3D数据
			params: $state.snapshot(this.params),
			initPositions: manualInit ? $state.snapshot(manualInit) : undefined
		});

		// 占位：在 History 里先占一个位置用于显示进度
		// (如果不占位，UI 会因为 currentProjectionData 为空而不渲染)
		// 这里我们先不做复杂的占位，而是依靠 updateCurrentProjectionRealtime 动态推数据
	}

	/**
	 * 停止计算
	 */
	stop() {
		this.worker?.postMessage({ type: 'STOP' });
		this.isCalculating = false;
	}

	private updateCurrentProjectionRealtime(embedding: number[][]) {
		// 临时策略：如果当前已经是最新，就直接改；如果当前没有，就 push 一个临时的
		if (this.history.length === 0 || this.currentProjectionIdx === -1) {
			this.history.push({ data: embedding, thumbnail: '', params: this.params });
			this.currentProjectionIdx = 0;
		} else {
			// 直接修改当前引用的数据以触发响应式更新
			this.history[this.currentProjectionIdx].data = embedding;
		}
	}

	private finishCalculation(embedding: number[][]) {
		const thumbnail = ''; // TODO

		// 逻辑：每次 Finish，都应该把当前结果 Push 进 History
		// 这样 Previous 才能指向 index-1，Current 指向 index
		
		// 1. 保存新记录
		// 必须深拷贝 params，否则后续修改 params 会影响历史记录
		const snapshotParams = $state.snapshot(this.params);
		const newRecord = { 
			data: embedding, 
			thumbnail, 
			params: snapshotParams
		};
		this.history.push(newRecord);

		// 2. 更新指针
		// Previous 变为原来的 Current
		if (this.currentProjectionIdx !== -1) {
			this.previousProjectionIdx = this.currentProjectionIdx;
		}
		// Current 指向最新
		this.currentProjectionIdx = this.history.length - 1;
		
		// 3. 重置动画进度 (让用户看到变化)
		// 如果有 Previous，我们把进度设为 0 (显示 Previous)，让用户自己拖到 1 (Current)
		if (this.previousProjectionIdx !== -1) {
			this.animationProgress = 0.0; 
			// 可选：自动播放动画
			// this.playAnimation(); 
		} else {
			this.animationProgress = 1.0;
		}
		
		console.log(`History updated. Curr: ${this.currentProjectionIdx}, Prev: ${this.previousProjectionIdx}`);
	}

	private setupCategories(labels: any[], type: string) {
		const info: Record<string, any> = {};
		const uniqueLabels = [...new Set(labels)];
		const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];
		uniqueLabels.forEach((label, index) => {
			const labelStr = String(label);
			const count = labels.filter(l => l === label).length;
			info[labelStr] = { cluster_id: index, size: count, color: colors[index % colors.length] };
		});
		this.categoriesInfo = { 'Label': info };
	}
}

export const appState = new AppState();