<script lang="ts">
	import { appState } from '$lib/stores/app.svelte';

	const initMethods = ['random', 'pca', 'spectral', 'current'] as const;

	async function handleRun() {
		if (!appState.dataset) {
			alert('Please load a dataset first.');
			return;
		}

		if (appState.isCalculating) {
			appState.stop();
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

<div class="border-t border-gray-200/50 bg-white/80 p-4 backdrop-blur-md">
	{#if appState.dataset}
		<div class="mb-3">
			<!-- Label row with info tooltip -->
			<div class="mb-1.5 flex items-center gap-1.5">
				<span class="text-xs font-medium tracking-wide text-gray-500 uppercase">Initialization</span
				>
				<div class="group relative">
					<span
						class="flex h-3.5 w-3.5 shrink-0 cursor-help items-center justify-center rounded-full border border-gray-300 text-[10px] text-gray-400 select-none"
						>?</span
					>
					<div
						class="pointer-events-none absolute bottom-full -left-3.5 z-50 mb-2 hidden w-60 rounded bg-gray-800 p-2 text-xs text-white shadow-lg group-hover:block"
					>
						<em>Spectral</em> uses pre-computed init files and only available for default datasets.
						<br />
						<em>Current</em> uses the active 2D result as initialization.
						<div
							class="absolute top-full left-4 border-4 border-transparent border-t-gray-800"
						></div>
					</div>
				</div>
			</div>

			<!-- Segmented control -->
			<div class="flex overflow-hidden rounded-md border border-gray-200 text-xs font-medium">
				{#each initMethods as method (method)}
					{@const isActive = appState.initMethod === method}
					{@const isDisabled =
						(method === 'spectral' && !appState.isLocalDataset) ||
						(method === 'current' && appState.currentProjectionIdx === -1)}
					<button
						class="flex-1 py-1.5 transition-colors
							{isActive ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}
							{isDisabled ? 'cursor-not-allowed opacity-40' : ''}"
						onclick={() => {
							if (!isDisabled) appState.initMethod = method;
						}}
						disabled={isDisabled}
					>
						{method === 'pca' ? 'PCA' : method[0].toUpperCase() + method.slice(1)}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if appState.isCalculating}
		<div
			class="mb-3 flex animate-pulse items-center justify-between font-mono text-xs text-blue-600"
		>
			<span>{appState.isKnnDone ? 'Optimizing...' : 'Building KNN...'}</span>
			<span>{appState.currentEpoch} / {appState.totalEpochs}</span>
		</div>
		<div class="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
			<div
				class="h-1.5 rounded-full bg-blue-600 transition-all duration-75"
				style="width: {(appState.currentEpoch / appState.totalEpochs) * 100}%"
			></div>
		</div>
	{/if}

	<button
		onclick={handleRun}
		disabled={!appState.dataset}
		class="w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-bold tracking-wider text-white uppercase shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
	>
		{appState.isCalculating
			? 'Stop'
			: appState.initMethod === 'current'
				? 'Re-run with Priors'
				: 'Run UMAP'}
	</button>
</div>
