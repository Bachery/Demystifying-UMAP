<script lang="ts">
	import DatasetSelector from './DatasetSelector.svelte';
	import SidebarComponent from './SidebarComponent.svelte';
	import SidebarCategory from './SidebarCategory.svelte';
	import RunControl from '$lib/components/Controls/RunControl.svelte';
	import { appState } from '$lib/stores/app.svelte';

	let categoryNames = $derived(Object.keys(appState.categoriesInfo));
</script>

<div class="flex h-full flex-col bg-transparent">
	<div
		class="sticky top-0 z-10 flex items-baseline justify-between border-b border-gray-200/50 bg-white/40 p-5 backdrop-blur-md"
	>
		<h2 class="text-2xl font-bold tracking-tight text-gray-800">Dataset</h2>
		<span class="rounded-md bg-gray-100 px-2 py-1 font-mono text-sm text-gray-500 shadow-inner">
			{appState.dataSize > 0 ? `${appState.dataSize} pts` : 'No data'}
		</span>
	</div>

	<div class="custom-scrollbar flex-1 overflow-x-hidden overflow-y-auto p-5">
		<div class="mb-6">
			<h3 class="mb-3 text-xs font-semibold tracking-wider text-gray-400 uppercase">Data Source</h3>
			<DatasetSelector />
		</div>

		<SidebarComponent title="Labels & Colors">
			{#if categoryNames.length > 0}
				{#each categoryNames as categoryName (categoryName)}
					<SidebarCategory {categoryName} />
				{/each}
			{:else}
				<div class="py-2 text-sm text-gray-400 italic">
					Load or generate a dataset to inspect label groups.
				</div>
			{/if}
		</SidebarComponent>
	</div>

	<RunControl />
</div>

<style>
	/* 自定义一个极其优雅、极细的滚动条 */
	.custom-scrollbar::-webkit-scrollbar {
		width: 6px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background-color: rgba(156, 163, 175, 0.4);
		border-radius: 20px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background-color: rgba(156, 163, 175, 0.7);
	}
</style>
