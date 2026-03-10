<script lang="ts">
	import { slide } from 'svelte/transition';
	import { appState } from '$lib/stores/app.svelte';

	let { categoryName, initiallyExpanded = true } = $props();

	// svelte-ignore state_referenced_locally
	let isExpanded = $state(initiallyExpanded);

	let categoryInfo = $derived(appState.categoriesInfo[categoryName] || {});
	let clustersNames = $derived(Object.keys(categoryInfo));
</script>

<div class="mb-2 w-full">
	<button
		class="flex w-full items-center text-left text-sm font-medium text-gray-700 transition-colors hover:text-blue-600"
		onclick={() => (isExpanded = !isExpanded)}
	>
		<span
			class="mr-2 inline-block text-xs transition-transform duration-200"
			class:rotate-90={isExpanded}>▶</span
		>
		{categoryName}
	</button>

	{#if isExpanded}
		<div class="mt-2 ml-4" transition:slide={{ duration: 150 }}>
			{#if appState.dataset?.type === 'continuous' && appState.continuousRange}
				<!-- Gradient bar for continuous labels, from blue at the minimum to red at the maximum. -->
				<div
					class="h-4 w-full rounded shadow-inner"
					style="background: linear-gradient(to right, hsl(240,85%,50%), hsl(180,85%,50%), hsl(120,85%,50%), hsl(60,85%,50%), hsl(0,85%,50%));"
				></div>
				<div class="mt-1 flex justify-between font-mono text-[10px] text-gray-400">
					<span>{appState.continuousRange.min.toFixed(2)}</span>
					<span>{appState.continuousRange.max.toFixed(2)}</span>
				</div>
			{:else}
				<div class="flex flex-col gap-1.5">
					{#each clustersNames as clusterName (clusterName)}
						<div class="group flex items-center text-sm">
							<div
								class="mr-2 h-3 w-3 rounded-full border border-gray-200 shadow-sm"
								style="background-color: {categoryInfo[clusterName].color};"
							></div>
							<span class="flex-1 truncate text-gray-600 group-hover:text-gray-900">
								{clusterName}
							</span>
							<span class="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs text-gray-400">
								{categoryInfo[clusterName].size}
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
