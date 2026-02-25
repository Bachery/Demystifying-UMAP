<script lang="ts">
	import DatasetSelector from './DatasetSelector.svelte';
	import SidebarComponent from './SidebarComponent.svelte';
	import SidebarCategory from './SidebarCategory.svelte';
	import RunControl from '$lib/components/Controls/RunControl.svelte';
	import { appState } from '$lib/stores/app.svelte';

	// 假设未来支持选择不同的类别作为标签
	let selectedCatColumn = $state('default'); 
</script>

<div class="h-full flex flex-col bg-transparent">
	
	<div class="p-5 border-b border-gray-200/50 bg-white/40 sticky top-0 z-10 backdrop-blur-md flex justify-between items-baseline">
		<h2 class="text-2xl font-bold tracking-tight text-gray-800">Dataset</h2>
		<span class="text-sm font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded-md shadow-inner">
			{appState.dataSize > 0 ? `${appState.dataSize} pts` : 'No data'}
		</span>
	</div>

	<div class="p-5 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">

		<div class="mb-6">
			<h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Data Source</h3>
			<DatasetSelector />
		</div>

		<SidebarComponent title="Labels & Clusters">
			{#if appState.categoricalColumns.length > 0}
				{#each appState.categoricalColumns as col}
					<div class="flex items-start gap-2 mb-2">
						<input
							type="radio"
							name="cat-group"
							bind:group={selectedCatColumn}
							value={col}
							class="mt-1 text-blue-600 focus:ring-blue-500 border-gray-300"
						/>
						<SidebarCategory categoryName={col} />
					</div>
				{/each}
			{:else}
				<div class="text-gray-400 italic text-sm py-2">No categorical data available.</div>
			{/if}
		</SidebarComponent>

		<SidebarComponent title="Features (Dimensions)" initiallyExpanded={false}>
			{#if appState.numericalColumns.length > 0}
				<div class="flex flex-col gap-2">
					{#each appState.numericalColumns as col}
						<label class="flex items-center text-sm text-gray-600">
							<input type="checkbox" checked={true} class="rounded text-blue-600 mr-2 border-gray-300"/>
							{col}
						</label>
					{/each}
				</div>
			{:else}
				<div class="text-gray-400 italic text-sm py-2">Intrinsic 3D coordinates are used.</div>
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