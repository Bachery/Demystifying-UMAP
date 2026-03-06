<script lang="ts">
	import { appState } from '$lib/stores/app.svelte';

	const initMethods = ['random', 'pca', 'spectral', 'current'] as const;

	async function handleRun() {
		if (!appState.dataset) {
			alert("Please load a dataset first.");
			return;
		}
		await appState.runUMAP();
	}

	// Auto-select 'current' init when the active history entry is steered
	$effect(() => {
		const entry = appState.history[appState.currentProjectionIdx];
		if (entry?.steered) {
			appState.initMethod = 'current';
		}
	});
</script>

<div class="p-4 border-t border-gray-200/50 bg-white/80 backdrop-blur-md">

	{#if appState.dataset}
		<div class="mb-3">
			<!-- Label row with info tooltip -->
			<div class="flex items-center gap-1.5 mb-1.5">
				<span class="text-xs text-gray-500 font-medium uppercase tracking-wide">Initialization</span>
				<div class="relative group">
					<span class="text-[10px] text-gray-400 cursor-help border border-gray-300 rounded-full w-3.5 h-3.5 flex items-center justify-center shrink-0 select-none">?</span>
					<div class="absolute bottom-full left-0 mb-1.5 w-64 text-xs text-white bg-gray-800 rounded p-2 shadow-lg hidden group-hover:block z-50 pointer-events-none">
						<em>Spectral</em> uses pre-computed init files and only available for default datasets. <br>
						<em>Current</em> uses the active 2D result as initialization.
						<div class="absolute top-full left-4 border-4 border-transparent border-t-gray-800"></div>
					</div>
				</div>
			</div>

			<!-- Segmented control -->
			<div class="flex rounded-md overflow-hidden border border-gray-200 text-xs font-medium">
				{#each initMethods as method}
					{@const isActive = appState.initMethod === method}
					{@const isDisabled =
						(method === 'spectral' && !appState.isLocalDataset) ||
						(method === 'current' && appState.currentProjectionIdx === -1)}
					<button
						class="flex-1 py-1.5 transition-colors
							{isActive ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}
							{isDisabled ? 'opacity-40 cursor-not-allowed' : ''}"
						onclick={() => { if (!isDisabled) appState.initMethod = method; }}
						disabled={isDisabled}
					>
						{method === 'pca' ? 'PCA' : method[0].toUpperCase() + method.slice(1)}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if appState.isCalculating}
		<div class="mb-3 flex justify-between items-center text-xs font-mono text-blue-600 animate-pulse">
			<span>{appState.isKnnDone ? 'Optimizing...' : 'Building KNN...'}</span>
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
		{appState.isCalculating ? 'Stop' : (appState.initMethod === 'current' ? 'Re-run with Priors' : 'Run UMAP')}
	</button>

</div>
