<script lang="ts">
	import { Canvas } from '@threlte/core';
	import Scene3D from './Scene3D.svelte';
	import { appState } from '$lib/stores/app.svelte';
	import { WebGLRenderer } from 'three';
	import ScreenshotDialog from '$lib/components/UI/ScreenshotDialog.svelte';
	import {
		downloadCanvasAsPng,
		normalizePngFilename,
		waitForCanvasRedraw
	} from '$lib/utils/screenshot';

	let autoRotate = $state(false);
	let showGrid3D = $state(true);
	let showAxes3D = $state(true);
	let screenshotDialogOpen = $state(false);
	let screenshotFilename = $state('');
	let screenshotIncludeGrid = $state(true);
	let screenshotIncludeAxes = $state(true);
	let isSavingScreenshot = $state(false);

	function getDefaultScreenshotFilename3D() {
		return `${appState.dataset?.name ?? 'ground-truth'}_3d.png`;
	}

	function openScreenshotDialog3D() {
		screenshotFilename = getDefaultScreenshotFilename3D();
		screenshotIncludeGrid = showGrid3D;
		screenshotIncludeAxes = showAxes3D;
		screenshotDialogOpen = true;
	}

	async function saveScreenshot3D() {
		isSavingScreenshot = true;
		const previousShowGrid = showGrid3D;
		const previousShowAxes = showAxes3D;
		try {
			showGrid3D = screenshotIncludeGrid;
			showAxes3D = screenshotIncludeAxes;
			await waitForCanvasRedraw();
			const canvas = document.querySelector('#canvas-3d canvas') as HTMLCanvasElement | null;
			if (canvas) {
				downloadCanvasAsPng(
					canvas,
					normalizePngFilename(screenshotFilename, getDefaultScreenshotFilename3D())
				);
			}
			screenshotDialogOpen = false;
		} finally {
			showGrid3D = previousShowGrid;
			showAxes3D = previousShowAxes;
			isSavingScreenshot = false;
		}
	}

	function handleSaveData3D() {
		const data = appState.dataMatrix;
		const labels = appState.labelsOfSelectedCat;
		if (!data.length) return;
		const dim = data[0].length;
		const headers = Array.from({ length: dim }, (_, i) => `x${i}`).join(',') + ',label';
		const rows = data.map((row, i) => row.join(',') + ',' + (labels[i] ?? ''));
		const csv = [headers, ...rows].join('\n');
		const blob = new Blob([csv], { type: 'text/csv' });
		const link = document.createElement('a');
		link.download = `${appState.dataset?.name ?? 'data'}_3d.csv`;
		link.href = URL.createObjectURL(blob);
		link.click();
		URL.revokeObjectURL(link.href);
	}
</script>

<div
	id="canvas-3d"
	class="relative h-full w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-inner"
>
	<div
		class="pointer-events-none absolute top-3 left-3 z-10 rounded border border-gray-200 bg-white/80 px-2 py-1 shadow-sm backdrop-blur"
	>
		<h3 class="text-xs font-bold tracking-wider text-gray-600 uppercase">Ground Truth (3D)</h3>
	</div>

	<Canvas
		createRenderer={(canvas) => {
			return new WebGLRenderer({
				canvas,
				preserveDrawingBuffer: true, // Keep framebuffer pixels available for screenshots.
				antialias: true,
				alpha: true
			});
		}}
	>
		<Scene3D {autoRotate} showGrid={showGrid3D} showAxes={showAxes3D} />
	</Canvas>

	<div
		class="pointer-events-none absolute right-3 bottom-3 left-3 z-10 flex items-center justify-between"
	>
		<div
			class="pointer-events-auto flex items-center gap-2 rounded-lg border border-gray-200 bg-white/90 p-1 shadow-sm backdrop-blur"
		>
			<button
				class="rounded px-2 py-1 text-[10px] font-medium transition-colors"
				class:bg-blue-100={autoRotate}
				class:text-blue-700={autoRotate}
				class:text-gray-500={!autoRotate}
				class:hover:bg-gray-100={!autoRotate}
				onclick={() => (autoRotate = !autoRotate)}
			>
				Auto Rotate {autoRotate ? 'ON' : 'OFF'}
			</button>
		</div>

		<div
			class="pointer-events-auto flex items-center rounded-lg border border-gray-200 bg-white/90 p-1 shadow-sm backdrop-blur"
		>
			<button
				onclick={handleSaveData3D}
				disabled={!appState.dataSize}
				class="rounded p-1.5 text-gray-500 transition-colors hover:bg-green-50 hover:text-green-600 disabled:cursor-not-allowed disabled:opacity-30"
				title="Download Raw Data (CSV)"
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
				onclick={openScreenshotDialog3D}
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
</div>

<ScreenshotDialog
	open={screenshotDialogOpen}
	title="Save 3D View"
	filename={screenshotFilename}
	includeGrid={screenshotIncludeGrid}
	includeAxes={screenshotIncludeAxes}
	saving={isSavingScreenshot}
	onCancel={() => (screenshotDialogOpen = false)}
	onFilenameChange={(value) => (screenshotFilename = value)}
	onIncludeGridChange={(value) => (screenshotIncludeGrid = value)}
	onIncludeAxesChange={(value) => (screenshotIncludeAxes = value)}
	onSave={saveScreenshot3D}
/>
