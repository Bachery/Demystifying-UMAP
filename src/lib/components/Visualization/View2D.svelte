<script lang="ts">
	import { Canvas } from '@threlte/core';
	import Scene2D from './Scene2D.svelte';
	import { appState } from '$lib/stores/app.svelte';
	import { WebGLRenderer } from 'three';

	// 交互状态
	let isSelecting = $state(false);
	let selectionStart = $state({ x: 0, y: 0 });
	let selectionEnd = $state({ x: 0, y: 0 });
	let selectionBox = $derived.by(() => {
		if (!isSelecting) return null;
		const left = Math.min(selectionStart.x, selectionEnd.x);
		const top = Math.min(selectionStart.y, selectionEnd.y);
		const width = Math.abs(selectionEnd.x - selectionStart.x);
		const height = Math.abs(selectionEnd.y - selectionStart.y);
		return { left, top, width, height };
	});

	// 拖拽逻辑 (Steering)
	let isDraggingPoints = false;
	let lastMousePos = { x: 0, y: 0 };

	function handleMouseDown(e: MouseEvent) {
		// 如果按住 Shift 或者是右键，启用框选
		if (e.shiftKey || e.button === 2) {
			isSelecting = true;
			const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
			selectionStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
			selectionEnd = { ...selectionStart };
			e.preventDefault(); // 阻止默认右键菜单
		} else if (appState.manualMode && appState.draggedPointsIdx.length > 0 && appState.selectedPointIdx !== null) {
			// 如果处于 Manual Mode 且 鼠标指着一个被选中的点 -> 开始拖拽
			isDraggingPoints = true;
			lastMousePos = { x: e.clientX, y: e.clientY };
		}
	}

	function handleMouseMove(e: MouseEvent) {
		if (isSelecting) {
			const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
			selectionEnd = { x: e.clientX - rect.left, y: e.clientY - rect.top };
		} 
		else if (isDraggingPoints) {
			// 计算屏幕位移
			const dx = e.clientX - lastMousePos.x;
			const dy = e.clientY - lastMousePos.y;
			
			// 屏幕位移 -> 数据位移
			// 这是一个近似值，因为我们不知道相机的 Zoom。
			// 更好的做法是在 Scene2D 里把 camera 导出来算。
			// 简单起见，给一个感性的缩放因子 (0.05)，用户可以自己感觉
			const scaleFactor = 0.05; 
			const dataDx = dx * scaleFactor;
			const dataDy = -dy * scaleFactor; // Y轴反转

			// 更新所有被拖拽点的坐标
			// 注意：我们直接修改 currentProjectionData 里的坐标
			// 这需要 AppState 提供一个 action
			updateDraggedPoints(dataDx, dataDy);

			lastMousePos = { x: e.clientX, y: e.clientY };
		}
	}

	function handleMouseUp() {
		if (isSelecting) {
			// TODO: 实现框选逻辑 (把屏幕坐标转为世界坐标，然后 filter points)
			// 这步比较麻烦，因为需要相机的投影矩阵。
			// 暂时先空着，或者只实现拖拽。
			isSelecting = false;
		}
		isDraggingPoints = false;
	}

	// 辅助函数：更新拖拽点
	function updateDraggedPoints(dx: number, dy: number) {
		// 我们不能直接改 derived 的 pointsToRender
		// 我们必须改 source: history[current].data
		const currentData = appState.history[appState.currentProjectionIdx].data;
		const draggedSet = new Set(appState.draggedPointsIdx);
		
		// 批量修改
		appState.draggedPointsIdx.forEach(idx => {
			if (currentData[idx]) {
				currentData[idx][0] += dx;
				currentData[idx][1] += dy;
			}
		});
		
		// 触发 Svelte 响应式更新 (赋值给自己)
		// appState.history = [...appState.history]; // 暴力触发
		// 或者更优雅地：AppState 内部应该提供 updatePointPosition 方法
		// 暂时暴力触发:
		appState.history[appState.currentProjectionIdx].data = currentData; 
	}
</script>

<div class="w-full h-full relative bg-white rounded-xl shadow-inner border border-gray-200 overflow-hidden select-none">
	
	<div class="absolute top-3 left-3 z-10 bg-white/80 backdrop-blur px-2 py-1 rounded border border-gray-200 shadow-sm pointer-events-none">
		<h3 class="text-xs font-bold text-gray-600 uppercase tracking-wider">UMAP Projection (2D)</h3>
	</div>

	
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div 
		class="absolute inset-0 z-10 outline-none"
		role="application"
		aria-label="Interactive UMAP Projection Canvas"
		tabindex="-1"
		onmousedown={handleMouseDown}
		onmousemove={handleMouseMove}
		onmouseup={handleMouseUp}
		onmouseleave={handleMouseUp}
		oncontextmenu={(e) => e.preventDefault()}
	>
		{#if selectionBox}
			<div 
				class="absolute border border-blue-500 bg-blue-200/30 pointer-events-none"
				style="left: {selectionBox.left}px; top: {selectionBox.top}px; width: {selectionBox.width}px; height: {selectionBox.height}px;"
			></div>
		{/if}
	</div>

	<Canvas
		createRenderer={(canvas) => {
			return new WebGLRenderer({
				canvas,
				preserveDrawingBuffer: true,
				antialias: true,
				alpha: true
			});
		}}
	>
		<Scene2D />
	</Canvas>

	<div class="absolute bottom-3 left-3 right-3 z-20 flex justify-between items-center pointer-events-none">
		<div class="pointer-events-auto bg-white/90 backdrop-blur rounded-lg shadow-sm border border-gray-200 p-1 flex gap-2">
			<button class="px-2 py-1 text-[10px] hover:bg-gray-100 rounded" onclick={() => { /* flipX */ }}>🔁 Flip X</button>
			<button class="px-2 py-1 text-[10px] hover:bg-gray-100 rounded" onclick={() => { /* rotate */ }}>↪️ Rotate</button>
		</div>
	</div>

	{#if appState.selectedPointIdx !== null}
		<div class="absolute top-3 right-3 z-20 bg-black/70 backdrop-blur text-white px-3 py-2 rounded shadow-lg pointer-events-none text-xs">
			<p><span class="text-gray-400">Index:</span> {appState.selectedPointIdx}</p>
			<p><span class="text-gray-400">Cluster:</span> {appState.labelsOfSelectedCat[appState.selectedPointIdx]}</p>
		</div>
	{/if}

</div>