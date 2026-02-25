<script lang="ts">
	import { appState } from '$lib/stores/app.svelte';

	function handleRun() {
		if (!appState.dataset) {
			alert("Please load a dataset first.");
			return;
		}

		if (appState.manualMode && appState.draggedPointsIdx.length > 0) {
			const currentEmbedding = $state.snapshot(appState.currentProjectionData);
			appState.runUMAP(currentEmbedding);
		} else {
			appState.runUMAP();
		}
	}
</script>

<div class="p-4 border-t border-gray-200/50 bg-white/80 backdrop-blur-md">

	{#if appState.isCalculating}
		<div class="mb-3 flex justify-between items-center text-xs font-mono text-blue-600 animate-pulse">
			<span>Optimizing...</span>
			<span>{appState.currentEpoch} / {appState.totalEpochs}</span>
		</div>
		<div class="w-full bg-gray-200 rounded-full h-1.5 mb-4 overflow-hidden">
			<div
				class="bg-blue-600 h-1.5 rounded-full transition-all duration-75"
				style="width: {(appState.currentEpoch / appState.totalEpochs) * 100}%"
			></div>
		</div>
	{/if}

	<button
		onclick={handleRun}
		disabled={!appState.dataset || appState.isCalculating}
		class="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold uppercase tracking-wider rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
	>
		{appState.isCalculating ? 'Stop' : (appState.manualMode ? 'Re-run with Priors' : 'Run UMAP')}
	</button>

</div>
