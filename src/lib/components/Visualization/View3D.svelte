<script lang="ts">
	import { Canvas } from '@threlte/core';
	import Scene3D from './Scene3D.svelte';
	import { appState } from '$lib/stores/app.svelte';
	import { WebGLRenderer } from 'three'; // [1] 新增引入

	let autoRotate = $state(false);

	function handleScreenshot() {
		const canvas = document.querySelector('#canvas-3d canvas') as HTMLCanvasElement;
		if (canvas) {
			const link = document.createElement('a');
			link.download = `${appState.dataset?.name ?? 'ground-truth'}_3d.png`;
			link.href = canvas.toDataURL('image/png');
			link.click();
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

<div id="canvas-3d" class="w-full h-full relative bg-white rounded-xl shadow-inner border border-gray-200 overflow-hidden">
	
	<div class="absolute top-3 left-3 z-10 bg-white/80 backdrop-blur px-2 py-1 rounded border border-gray-200 shadow-sm pointer-events-none">
		<h3 class="text-xs font-bold text-gray-600 uppercase tracking-wider">Ground Truth (3D)</h3>
	</div>

	<Canvas
		createRenderer={(canvas) => {
			return new WebGLRenderer({
				canvas,
				preserveDrawingBuffer: true, // 关键：允许截图
				antialias: true,
				alpha: true
			});
		}}
	>
		<Scene3D {autoRotate} />
	</Canvas>

	<div class="absolute bottom-3 left-3 right-3 z-10 flex justify-between items-center pointer-events-none">
		<div class="pointer-events-auto bg-white/90 backdrop-blur rounded-lg shadow-sm border border-gray-200 p-1 flex items-center gap-2">
			<button 
				class="px-2 py-1 text-[10px] font-medium rounded transition-colors"
				class:bg-blue-100={autoRotate}
				class:text-blue-700={autoRotate}
				class:text-gray-500={!autoRotate}
				class:hover:bg-gray-100={!autoRotate}
				onclick={() => autoRotate = !autoRotate}
			>
				Auto Rotate {autoRotate ? 'ON' : 'OFF'}
			</button>
		</div>

		<div class="pointer-events-auto bg-white/90 backdrop-blur rounded-lg shadow-sm border border-gray-200 p-1 flex items-center">
			<button
				onclick={handleSaveData3D}
				disabled={!appState.dataSize}
				class="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
				title="Download Raw Data (CSV)"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
			</button>
			<button
				onclick={handleScreenshot}
				class="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
				title="Save Screenshot"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
			</button>
		</div>
	</div>
</div>