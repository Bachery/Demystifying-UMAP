<script lang="ts">
	import { appState } from '$lib/stores/app.svelte';
	import SidebarDataset from '$lib/components/Controls/SidebarDataset.svelte';
	import SidebarInteraction from '$lib/components/Controls/SidebarInteraction.svelte';
	import View3D from '$lib/components/Visualization/View3D.svelte';
	import View2D from '$lib/components/Visualization/View2D.svelte';

	// 控制 Tab 切换的状态
	let activeTab = $state('dataset'); // 'dataset' | 'interaction'
</script>

<svelte:head>
	<title>UMAP Diagnostics</title>
</svelte:head>

<main class="w-screen h-screen overflow-hidden flex bg-gray-50/50 font-sans text-gray-800">
	
	<div class="h-full z-10 relative flex flex-col w-96 bg-white/60 backdrop-blur-xl border-r border-gray-200/50 shadow-[4px_0_24px_rgba(0,0,0,0.05)]">
		
		<div class="flex border-b border-gray-200/50">
			<button 
				class="flex-1 py-3 text-sm font-medium transition-colors relative"
				class:text-blue-600={activeTab === 'dataset'}
				class:text-gray-500={activeTab !== 'dataset'}
				class:bg-blue-50={activeTab === 'dataset'}
				onclick={() => activeTab = 'dataset'}
			>
				Dataset
				{#if activeTab === 'dataset'}
					<div class="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>
				{/if}
			</button>
			<button 
				class="flex-1 py-3 text-sm font-medium transition-colors relative"
				class:text-blue-600={activeTab === 'interaction'}
				class:text-gray-500={activeTab !== 'interaction'}
				class:bg-blue-50={activeTab === 'interaction'}
				onclick={() => activeTab = 'interaction'}
			>
				Interaction
				{#if activeTab === 'interaction'}
					<div class="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>
				{/if}
			</button>
		</div>

		<div class="flex-1 overflow-hidden relative">

			<div class="absolute inset-0 w-full h-full" class:hidden={activeTab !== 'dataset'}>
				<SidebarDataset />
			</div>

			<div class="absolute inset-0 w-full h-full" class:hidden={activeTab !== 'interaction'}>
				<SidebarInteraction />
			</div>

		</div>
	</div>

	<!-- <div class="flex-1 relative flex flex-col items-center justify-center bg-slate-100/50 overflow-hidden">
		<div class="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-50"></div>
		
		<div class="relative z-10 flex flex-col items-center">
			<svg class="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"></path></svg>
			<h1 class="text-gray-400 font-medium text-xl tracking-widest uppercase">
				Visualization Canvas
			</h1>
			<p class="text-gray-400 text-sm mt-2">
				Loaded: {appState.dataset?.name || 'None'}
			</p>
		</div>
	</div> -->

	<div class="flex-1 relative flex flex-col items-center justify-center bg-slate-100/50 overflow-hidden p-4">
		{#if appState.dataset}
			<div class="w-full h-full flex gap-4">
				<div class="flex-1 h-full">
					<View3D />
				</div>
				<div class="flex-1 h-full">
					<View2D />
				</div>
			</div>
		{:else}
			<div class="w-full h-full flex gap-4">
				<!-- 3D View Placeholder -->
				<div class="flex-1 h-full rounded-2xl bg-white/50 border border-gray-200/60 shadow-sm backdrop-blur-sm flex flex-col items-center justify-center gap-4 select-none">
					<div class="absolute inset-0 rounded-2xl bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] opacity-60 pointer-events-none"></div>
					<svg class="w-14 h-14 text-gray-300" fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
					</svg>
					<div class="text-center">
						<p class="text-gray-400 font-medium text-sm tracking-wider uppercase">3D View</p>
						<p class="text-gray-300 text-xs mt-1">Load a dataset to visualize</p>
					</div>
				</div>
				<!-- 2D View Placeholder -->
				<div class="flex-1 h-full rounded-2xl bg-white/50 border border-gray-200/60 shadow-sm backdrop-blur-sm flex flex-col items-center justify-center gap-4 select-none relative overflow-hidden">
					<div class="absolute inset-0 rounded-2xl bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] opacity-60 pointer-events-none"></div>
					<svg class="w-14 h-14 text-gray-300" fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24">
						<circle cx="5" cy="5" r="1.5" />
						<circle cx="12" cy="8" r="1.5" />
						<circle cx="19" cy="4" r="1.5" />
						<circle cx="7" cy="14" r="1.5" />
						<circle cx="15" cy="17" r="1.5" />
						<circle cx="10" cy="19" r="1.5" />
						<circle cx="18" cy="12" r="1.5" />
						<circle cx="4" cy="19" r="1.5" />
					</svg>
					<div class="text-center">
						<p class="text-gray-400 font-medium text-sm tracking-wider uppercase">2D View</p>
						<p class="text-gray-300 text-xs mt-1">Load a dataset to visualize</p>
					</div>
				</div>
			</div>
		{/if}
	</div>
</main>