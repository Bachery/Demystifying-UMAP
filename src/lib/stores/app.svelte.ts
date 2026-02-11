// src/lib/stores/app.svelte.ts

export class AppState {
	// ==========================================
	// 1. 基础数据与表格逻辑 (Data Table & Filtering)
	// ==========================================
	dataMatrix = $state<number[][]>([]); // [[x1,x2,x3], ...]
	dataSize = $state(0);
	usingRows = $state<number[]>([]);    // [0, 1, 2, ...]

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
	// 2. UMAP 参数与状态 (UMAP Parameters)
	// ==========================================
	params = $state({
		n_epochs: 500,
		n_neighbors: 15,
		min_dist: 0.2,
		repulsion_strength: 1.0,
	});

	constraintParams = $state({
		constraint_method: 'Hard',
		constraint_weight: 0.1
	});

	// ==========================================
	// 3. 投影历史与动画 (History & Morphing)
	// ==========================================
	history = $state<Array<{ data: number[][], thumbnail: string, params: any }>>([]);
	currentProjectionIdx = $state(-1);
	previousProjectionIdx = $state(-1);
	changePreviousIdx = $state(true);

	animationProgress = $state(1.0); // 0.0 to 1.0 (受 Sidebar Slider 控制)

	// Derived: 获取当前的和上一次的投影坐标
	currentProjectionData = $derived.by(() => {
		if (this.history.length === 0 || this.currentProjectionIdx === -1) return [];
		return this.history[this.currentProjectionIdx].data;
	});

	previousProjectionData = $derived.by(() => {
		if (this.history.length === 0 || this.previousProjectionIdx === -1) return [];
		return this.history[this.previousProjectionIdx].data;
	});

	// Derived: 结合 usingRows 过滤当前坐标，并计算补间动画 (Morphing) 坐标
	pointsToRender = $derived.by(() => {
		const curr = this.currentProjectionData;
		const prev = this.previousProjectionData;
		
		if (!curr.length || !this.usingRows.length) return [];

		return curr
			.filter((_, idx) => this.usingRows.includes(idx))
			.map((point, i) => {
				const actualIdx = this.usingRows[i]; // 映射回原数据的真实索引
				const cluster = this.labelsOfSelectedCat[actualIdx] || '';
				
				// 如果存在前一帧且进度 < 1.0，计算线性插值
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
				
				// 否则直接返回当前点
				return { idx: actualIdx, x: point[0], y: point[1], cluster };
			});
	});

	// ==========================================
	// 4. 交互与高亮分析 (Interaction & Analytics)
	// ==========================================
	selectedPointIdx = $state<number | null>(null);
	graphEdges = $state<Record<string, number[]>>({}); // {'sourceIdx': [targetIdx1, ...]}
	
	// Derived: 当前选中点的连线目标
	targetPointsIdx = $derived.by(() => {
		if (this.selectedPointIdx === null) return [];
		return this.graphEdges[String(this.selectedPointIdx)] || [];
	});

	// 不稳定点分析 (Unstable Points)
	ifHighlightUnstablePoints = $state(false);
	
	unstablePointsIdx = $derived.by(() => {
		if (!this.ifHighlightUnstablePoints || !this.currentProjectionData.length || !this.previousProjectionData.length) return [];
		
		const unstablePoints: number[] = [];
		const threshold = 1.0; 

		for (let i = 0; i < this.currentProjectionData.length; i++) {
			const curr = this.currentProjectionData[i];
			const prev = this.previousProjectionData[i];
			if (curr && prev) {
				const xDiff = Math.abs(curr[0] - prev[0]);
				const yDiff = Math.abs(curr[1] - prev[1]);
				if (xDiff > threshold || yDiff > threshold) {
					unstablePoints.push(i);
				}
			}
		}
		return unstablePoints;
	});

	// ==========================================
	// 5. Steering (Direct Manipulation)
	// ==========================================
	manualMode = $state(false);
	draggedPointsIdx = $state<number[]>([]);

	// ==========================================
	// 6. 全局方法 (Actions)
	// ==========================================
	/**
	 * 接收前端生成器或 Loader 传来的数据集，并初始化所有相关状态
	 */
	setDataset(result: any) {
		// 1. 基础数据
		this.dataMatrix = result.data;
		this.dataSize = result.data.length;
		
		// 默认使用所有行
		this.usingRows = Array.from({ length: this.dataSize }, (_, i) => i);

		// 2. 标签与分类数据
		this.categoricalColumns = ['Label']; // 默认给一列叫 Label
		this.selectedCatColumn = 'Label';
		this.labelsOfSelectedCat = result.labels.map(String);

		// 3. 构建 CategoriesInfo (用于颜色映射和侧边栏展示)
		this.setupCategories(result.labels, result.type);

		// 4. 清空历史记录 (因为换了新数据集)
		this.history = [];
		this.currentProjectionIdx = -1;
		this.previousProjectionIdx = -1;
		this.animationProgress = 1.0;

		console.log(`Dataset loaded: ${this.dataSize} points.`);
		
		// 未来：这里可以直接调用 this.runUMAP() 自动开始计算
	}

	/**
	 * 辅助方法：根据 labels 自动生成颜色和统计信息
	 */
	private setupCategories(labels: any[], type: string) {
		const info: Record<string, any> = {};
		const uniqueLabels = [...new Set(labels)];
		
		// 简单的默认颜色盘 (D3 Category10 风格)
		const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];

		uniqueLabels.forEach((label, index) => {
			const labelStr = String(label);
			const count = labels.filter(l => l === label).length;
			
			info[labelStr] = {
				cluster_id: index,
				size: count,
				color: colors[index % colors.length] // 循环分配颜色
			};
		});

		// 存入全局字典
		this.categoriesInfo = {
			'Label': info
		};
	}
}

// 导出全局单例
export const appState = new AppState();