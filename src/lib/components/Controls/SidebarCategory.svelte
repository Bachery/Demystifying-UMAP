<script lang="ts">
	import { slide } from 'svelte/transition';
	import { appState } from '$lib/stores/app.svelte';

	let { categoryName, initiallyExpanded = true } = $props();
	
	// svelte-ignore state_referenced_locally
	let isExpanded = $state(initiallyExpanded);
	
	// 使用 $derived 从全局状态读取 categoriesInfo
	let categoryInfo = $derived(appState.categoriesInfo[categoryName] || {});
	let clustersNames = $derived(Object.keys(categoryInfo));
	
	function handleToggleCluster(clusterName: string, event: Event) {
		const checked = (event.target as HTMLInputElement).checked;
		// 这里预留给以后实现：根据 checked 状态更新 appState.usingRows
		console.log(`Cluster ${clusterName} is now ${checked ? 'visible' : 'hidden'}`);
	}
</script>

<div class="w-full mb-2">
	<button 
		class="flex items-center text-gray-700 hover:text-blue-600 transition-colors w-full text-left font-medium text-sm"
		onclick={() => isExpanded = !isExpanded}
	>
		<span class="inline-block transition-transform duration-200 text-xs mr-2" class:rotate-90={isExpanded}>▶</span>
		{categoryName}
	</button>
	
	{#if isExpanded}
		<div class="mt-2 ml-4" transition:slide={{duration: 150}}>
			{#if appState.dataset?.type === 'continuous' && appState.continuousRange}
				<!-- Gradient color bar for continuous labels: blue (min) → red (max) -->
				<div
					class="w-full h-4 rounded shadow-inner"
					style="background: linear-gradient(to right, hsl(240,85%,50%), hsl(180,85%,50%), hsl(120,85%,50%), hsl(60,85%,50%), hsl(0,85%,50%));"
				></div>
				<div class="flex justify-between text-[10px] text-gray-400 mt-1 font-mono">
					<span>{appState.continuousRange.min.toFixed(2)}</span>
					<span>{appState.continuousRange.max.toFixed(2)}</span>
				</div>
			{:else}
				<!-- Discrete cluster list -->
				<div class="flex flex-col gap-1.5">
					{#each clustersNames as clusterName}
						<label class="flex items-center group cursor-pointer text-sm">
							<input
								type="checkbox"
								checked={true}
								onchange={(e) => handleToggleCluster(clusterName, e)}
								class="rounded text-blue-600 focus:ring-blue-500 mr-2 border-gray-300 transition-all"
							/>
							<div
								class="w-3 h-3 rounded-full mr-2 shadow-sm border border-gray-200"
								style="background-color: {categoryInfo[clusterName].color};"
							></div>
							<span class="text-gray-600 group-hover:text-gray-900 truncate flex-1">
								{clusterName}
							</span>
							<span class="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">
								{categoryInfo[clusterName].size}
							</span>
						</label>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>