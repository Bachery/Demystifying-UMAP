<script lang="ts">
	import { appState } from '$lib/stores/app.svelte';

	// 格式化 Epochs 参数，用于显示
	function formatParams(params: any) {
		if (!params) return 'N/A';
		return `NN:${params.nNeighbors} | Ep:${params.nEpochs}`;
	}

	let prevParams = $derived(
		appState.history[appState.previousProjectionIdx]?.params
	);
	let currParams = $derived(
		appState.history[appState.currentProjectionIdx]?.params
	);
</script>

<div class="bg-gray-50/80 rounded-lg p-3 border border-gray-200/60 shadow-inner flex flex-col gap-3">
	
	<div class="flex justify-between items-center">
		<h4 class="text-xs font-bold text-gray-500 uppercase tracking-wide">Result Comparison</h4>
		<span class="text-[10px] text-gray-400 font-mono">
			{Math.round(appState.animationProgress * 100)}%
		</span>
	</div>

	<div class="flex items-center gap-3">
		
		<div class="flex flex-col items-center gap-1 w-12">
			<div class="w-10 h-10 rounded border-2 border-dashed border-gray-300 bg-white flex items-center justify-center text-gray-300 overflow-hidden relative shadow-sm">
				{#if appState.previousProjectionIdx !== -1}
					<div class="w-full h-full bg-blue-100 text-[8px] flex items-center justify-center text-blue-400">PREV</div>
				{:else}
					<span class="text-[8px]">None</span>
				{/if}
			</div>
			<span class="text-[8px] text-gray-400 font-mono text-center leading-tight truncate w-full">
				{appState.previousProjectionIdx !== -1 ? `#${appState.previousProjectionIdx}` : '-'}
			</span>
		</div>

		<div class="flex-1 flex flex-col justify-center h-full pt-1">
			<input 
				type="range" 
				bind:value={appState.animationProgress} 
				min={0} max={1} step={0.01} 
				disabled={appState.previousProjectionIdx === -1}
				class="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600 hover:accent-purple-700 disabled:opacity-50"
			/>
			<div class="flex justify-between mt-1 px-1">
				<span class="text-[9px] text-gray-400">Prev</span>
				<span class="text-[9px] text-gray-400">Curr</span>
			</div>
		</div>

		<div class="flex flex-col items-center gap-1 w-12">
			<div class="w-10 h-10 rounded border-2 border-purple-500 bg-white flex items-center justify-center overflow-hidden relative shadow-md">
				{#if appState.currentProjectionIdx !== -1}
					<div class="w-full h-full bg-purple-100 text-[8px] flex items-center justify-center text-purple-600">CURR</div>
				{:else}
					<span class="text-[8px] text-gray-300">Empty</span>
				{/if}
			</div>
			<span class="text-[8px] text-gray-500 font-bold font-mono text-center leading-tight truncate w-full">
				{appState.currentProjectionIdx !== -1 ? `#${appState.currentProjectionIdx}` : '-'}
			</span>
		</div>
	</div>
	
	{#if appState.previousProjectionIdx !== -1}
		<div class="text-[9px] text-gray-400 text-center bg-white/50 rounded py-1 border border-gray-100">
			Comparing: <span class="font-mono">{formatParams(prevParams)}</span> 
			<span class="mx-1">→</span> 
			<span class="font-mono text-gray-600">{formatParams(currParams)}</span>
		</div>
	{/if}

</div>