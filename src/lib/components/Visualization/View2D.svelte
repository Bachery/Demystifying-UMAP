<script lang="ts">
	import { Canvas } from '@threlte/core';
	import Scene2D from './Scene2D.svelte';
	import { appState } from '$lib/stores/app.svelte';
	import { WebGLRenderer } from 'three';
	import ScreenshotDialog from '$lib/components/UI/ScreenshotDialog.svelte';
	import {
		downloadCanvasAsPng,
		normalizePngFilename,
		waitForCanvasRedraw
	} from '$lib/utils/screenshot';

	let screenshotDialogOpen = $state(false);
	let screenshotFilename = $state('');
	let screenshotIncludeGrid = $state(true);
	let isSavingScreenshot = $state(false);

	// Box selection state.
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

	// Point drag state used for manual steering.
	let isDraggingPoints = false;
	let lastMousePos = { x: 0, y: 0 };

	// Fast drag API exposed by Scene2D. It bypasses the reactive chain during drag.
	let _sceneAPI: {
		fastMoveDraggedPoints: (
			renderIndices: number[],
			dx: number,
			dy: number
		) => { dataDx: number; dataDy: number };
		setOrbitEnabled: (enabled: boolean) => void;
		setHoverEnabled: (enabled: boolean) => void;
		getPointsInScreenRect: (rect: {
			left: number;
			top: number;
			width: number;
			height: number;
		}) => number[];
	} | null = null;
	let _dragRenderIndices: number[] = [];
	let _accumDataDx = 0;
	let _accumDataDy = 0;
	let _justFinishedDrag = false; // Suppresses the click fired immediately after drag end.
	let _usingReactiveFallback = false;

	function updateDraggedPoints(dataDx: number, dataDy: number) {
		if (appState.currentProjectionIdx === -1) return;

		const source = $state.snapshot(
			appState.realtimeEmbedding ?? appState.history[appState.currentProjectionIdx].data
		) as number[][];
		const next = source.slice();

		for (const idx of appState.draggedPointsIdx) {
			if (source[idx]) {
				next[idx] = [source[idx][0] + dataDx, source[idx][1] + dataDy];
			}
		}

		appState.realtimeEmbedding = next;
		_accumDataDx += dataDx;
		_accumDataDy += dataDy;
		_usingReactiveFallback = true;
	}

	function handleMouseDown(e: MouseEvent) {
		// Shift-drag or right-drag enters box selection mode.
		if (e.shiftKey || e.button === 2) {
			isSelecting = true;
			const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
			selectionStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
			selectionEnd = { ...selectionStart };
			e.preventDefault(); // Suppress the default context menu.
		} else if (
			appState.manualMode &&
			appState.draggedPointsIdx.length > 0 &&
			appState.selectedPointIdx !== null
		) {
			// In manual mode, dragging starts only from a selected point.
			isDraggingPoints = true;
			lastMousePos = { x: e.clientX, y: e.clientY };
			_accumDataDx = 0;
			_accumDataDy = 0;
			_usingReactiveFallback = false;
			// Disable hover updates during drag. Pointer events continue firing and would
			// reset selectedPointIdx from reactive positions instead of the fast GPU path,
			// leaving the proxy marker behind and creating a ghost artifact.
			_sceneAPI?.setHoverEnabled(false);
			_sceneAPI?.setOrbitEnabled(false); // Prevent camera panning during point drag.

			// Precompute render indices once at drag start.
			const pts = appState.pointsToRender;
			const dataToRender: Record<number, number> = {};
			for (let ri = 0; ri < pts.length; ri++) dataToRender[pts[ri].idx] = ri;
			_dragRenderIndices = appState.draggedPointsIdx
				.map((idx) => dataToRender[idx])
				.filter((ri): ri is number => ri !== undefined);
		}
	}

	function handleMouseMove(e: MouseEvent) {
		if (isSelecting) {
			const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
			selectionEnd = { x: e.clientX - rect.left, y: e.clientY - rect.top };
		} else if (isDraggingPoints) {
			const dx = e.clientX - lastMousePos.x;
			const dy = e.clientY - lastMousePos.y;
			lastMousePos = { x: e.clientX, y: e.clientY };

			if (_sceneAPI && _dragRenderIndices.length > 0) {
				// Update the GPU buffer directly and return the data-space delta for commit.
				const { dataDx, dataDy } = _sceneAPI.fastMoveDraggedPoints(_dragRenderIndices, dx, dy);
				_accumDataDx += dataDx;
				_accumDataDy += dataDy;
			} else {
				// Fall back to the reactive path before Scene2D is ready.
				updateDraggedPoints(dx * 0.05, -dy * 0.05);
			}
		}
	}

	function handleMouseUp() {
		if (isSelecting) {
			// Require a minimum rectangle size to avoid accidental selections.
			if (selectionBox && selectionBox.width > 5 && selectionBox.height > 5) {
				const hitIndices = _sceneAPI?.getPointsInScreenRect(selectionBox) ?? [];
				if (hitIndices.length > 0) {
					const existingSet = new Set(appState.draggedPointsIdx);
					// Toggle the whole hit set off when every point is already selected.
					const allSelected = hitIndices.every((idx) => existingSet.has(idx));
					if (allSelected) {
						const removeSet = new Set(hitIndices);
						appState.draggedPointsIdx = appState.draggedPointsIdx.filter(
							(idx) => !removeSet.has(idx)
						);
					} else {
						const toAdd = hitIndices.filter((idx) => !existingSet.has(idx));
						appState.draggedPointsIdx = [...appState.draggedPointsIdx, ...toAdd];
					}
				}
			}
			isSelecting = false;
		}
		if (isDraggingPoints) {
			isDraggingPoints = false;
			_justFinishedDrag = true; // Suppress the click event fired after mouseup.
			_sceneAPI?.setHoverEnabled(true);
			_sceneAPI?.setOrbitEnabled(true); // Re-enable camera panning.
			// Commit the accumulated displacement as a new steered history entry.
			if (_accumDataDx !== 0 || _accumDataDy !== 0) {
				appState.commitDragAsNewHistory(appState.draggedPointsIdx, _accumDataDx, _accumDataDy);
			}
			if (_usingReactiveFallback) {
				appState.realtimeEmbedding = null;
				_usingReactiveFallback = false;
			}
			_dragRenderIndices = [];
			_accumDataDx = 0;
			_accumDataDy = 0;
		}
	}

	function getDefaultScreenshotFilename2D() {
		return `${appState.dataset?.name ?? 'embedding'}_2d.png`;
	}

	function openScreenshotDialog2D() {
		screenshotFilename = getDefaultScreenshotFilename2D();
		screenshotIncludeGrid = appState.showGrid2D;
		screenshotDialogOpen = true;
	}

	async function saveScreenshot2D() {
		isSavingScreenshot = true;
		const previousShowGrid = appState.showGrid2D;
		try {
			appState.showGrid2D = screenshotIncludeGrid;
			await waitForCanvasRedraw();
			const canvas = document.querySelector('#canvas-2d canvas') as HTMLCanvasElement | null;
			if (canvas) {
				downloadCanvasAsPng(
					canvas,
					normalizePngFilename(screenshotFilename, getDefaultScreenshotFilename2D())
				);
			}
			screenshotDialogOpen = false;
		} finally {
			appState.showGrid2D = previousShowGrid;
			isSavingScreenshot = false;
		}
	}

	function handleSaveData2D() {
		const data = appState.currentProjectionData;
		const labels = appState.labelsOfSelectedCat;
		if (!data.length) return;
		const headers = 'emb_x,emb_y,label';
		const rows = data.map((row, i) => `${row[0]},${row[1]},${labels[i] ?? ''}`);
		const csv = [headers, ...rows].join('\n');
		const blob = new Blob([csv], { type: 'text/csv' });
		const link = document.createElement('a');
		link.download = `${appState.dataset?.name ?? 'embedding'}_2d.csv`;
		link.href = URL.createObjectURL(blob);
		link.click();
		URL.revokeObjectURL(link.href);
	}

	// ==========================================
	// View transforms.
	// Use .map() to create a fresh array reference so Svelte re-evaluates derived state.
	// ==========================================
	function applyToCurrentData(transform: (x: number, y: number) => [number, number]) {
		if (appState.currentProjectionIdx === -1) return;
		// Snapshot returns a plain array and avoids repeated proxy reads inside map().
		const raw = $state.snapshot(appState.history[appState.currentProjectionIdx].data) as number[][];
		const transformed = raw.map((row) => {
			const [nx, ny] = transform(row[0], row[1]);
			return [nx, ny];
		});
		appState.history[appState.currentProjectionIdx].data = transformed;
		appState.history[appState.currentProjectionIdx].thumbnail =
			appState.generateThumbnail(transformed);
	}

	function handleFlipX() {
		applyToCurrentData((x, y) => [-x, y]);
	}

	function handleFlipY() {
		applyToCurrentData((x, y) => [x, -y]);
	}

	function handleRotate() {
		// Rotate 90 degrees clockwise: (x, y) -> (y, -x).
		applyToCurrentData((x, y) => [y, -x]);
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	id="canvas-2d"
	role="application"
	aria-label="2D UMAP interaction canvas"
	class="relative h-full w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-inner select-none"
	onmousedown={handleMouseDown}
	onmousemove={handleMouseMove}
	onmouseup={handleMouseUp}
	onmouseleave={handleMouseUp}
	oncontextmenu={(e) => e.preventDefault()}
	onclickcapture={(e) => {
		if (_justFinishedDrag) {
			e.stopPropagation();
			_justFinishedDrag = false;
		}
	}}
>
	<div
		class="pointer-events-none absolute top-3 left-3 z-10 rounded border border-gray-200 bg-white/80 px-2 py-1 shadow-sm backdrop-blur"
	>
		<h3 class="text-xs font-bold tracking-wider text-gray-600 uppercase">UMAP Projection (2D)</h3>
	</div>

	<!-- Visual overlay. Keep pointer events disabled so the canvas still receives input. -->
	<div class="pointer-events-none absolute inset-0 z-10">
		{#if selectionBox}
			<div
				class="pointer-events-none absolute border border-blue-500 bg-blue-200/30"
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
		<Scene2D
			showGrid={appState.showGrid2D}
			onReady={(api) => {
				_sceneAPI = api;
			}}
		/>
	</Canvas>

	<div
		class="pointer-events-none absolute right-3 bottom-3 left-3 z-20 flex items-center justify-between"
	>
		<div
			class="pointer-events-auto flex gap-1 rounded-lg border border-gray-200 bg-white/90 p-1 shadow-sm backdrop-blur"
		>
			<button
				class="rounded px-2 py-1 text-[10px] hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
				disabled={!appState.currentProjectionData.length}
				onclick={handleFlipX}
				title="Mirror horizontally (negate X)">&#x2194;&#xFE0E; Flip X</button
			>
			<button
				class="rounded px-2 py-1 text-[10px] hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
				disabled={!appState.currentProjectionData.length}
				onclick={handleFlipY}
				title="Mirror vertically (negate Y)">&#x2195;&#xFE0E; Flip Y</button
			>
			<button
				class="rounded px-2 py-1 text-[10px] hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
				disabled={!appState.currentProjectionData.length}
				onclick={handleRotate}
				title="Rotate 90° clockwise">&#x21BB;&#xFE0E; Rotate</button
			>
		</div>

		<div
			class="pointer-events-auto flex items-center rounded-lg border border-gray-200 bg-white/90 p-1 shadow-sm backdrop-blur"
		>
			<button
				onclick={handleSaveData2D}
				disabled={!appState.currentProjectionData.length}
				class="rounded p-1.5 text-gray-500 transition-colors hover:bg-green-50 hover:text-green-600 disabled:cursor-not-allowed disabled:opacity-30"
				title="Download Embedding (CSV)"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
					/></svg
				>
			</button>
			<button
				onclick={openScreenshotDialog2D}
				class="rounded p-1.5 text-gray-500 transition-colors hover:bg-blue-50 hover:text-blue-600"
				title="Save Screenshot"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
					></path><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
					></path></svg
				>
			</button>
		</div>
	</div>

	{#if appState.selectedPointIdx !== null}
		<div
			class="pointer-events-none absolute top-3 right-3 z-20 rounded bg-black/70 px-3 py-2 text-xs text-white shadow-lg backdrop-blur"
		>
			<p><span class="text-gray-400">Index:</span> {appState.selectedPointIdx}</p>
			<p>
				<span class="text-gray-400">Cluster:</span>
				{appState.labelsOfSelectedCat[appState.selectedPointIdx]}
			</p>
		</div>
	{/if}
</div>

<ScreenshotDialog
	open={screenshotDialogOpen}
	title="Save 2D View"
	filename={screenshotFilename}
	includeGrid={screenshotIncludeGrid}
	saving={isSavingScreenshot}
	onCancel={() => (screenshotDialogOpen = false)}
	onFilenameChange={(value) => (screenshotFilename = value)}
	onIncludeGridChange={(value) => (screenshotIncludeGrid = value)}
	onSave={saveScreenshot2D}
/>
