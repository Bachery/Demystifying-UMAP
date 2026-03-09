<script lang="ts">
	import { appState } from '$lib/stores/app.svelte';
	import SidebarDataset from '$lib/components/Controls/SidebarDataset.svelte';
	import SidebarInteraction from '$lib/components/Controls/SidebarInteraction.svelte';
	import View3D from '$lib/components/Visualization/View3D.svelte';
	import View2D from '$lib/components/Visualization/View2D.svelte';

	let activeTab = $state<'dataset' | 'interaction'>('dataset');
</script>

<svelte:head>
	<title>UMAP Diagnostics</title>
</svelte:head>

<main class="flex h-screen w-screen overflow-hidden bg-gray-50/50 font-sans text-gray-800">
	<div
		class="relative z-10 flex h-full w-96 flex-col border-r border-gray-200/50 bg-white/60 shadow-[4px_0_24px_rgba(0,0,0,0.05)] backdrop-blur-xl"
	>
		<div class="flex border-b border-gray-200/50">
			<button
				class="relative flex-1 py-3 text-sm font-medium transition-colors"
				class:text-blue-600={activeTab === 'dataset'}
				class:text-gray-500={activeTab !== 'dataset'}
				class:bg-blue-50={activeTab === 'dataset'}
				onclick={() => (activeTab = 'dataset')}
			>
				Dataset
				{#if activeTab === 'dataset'}
					<div class="absolute bottom-0 left-0 h-0.5 w-full bg-blue-600"></div>
				{/if}
			</button>
			<button
				class="relative flex-1 py-3 text-sm font-medium transition-colors"
				class:text-blue-600={activeTab === 'interaction'}
				class:text-gray-500={activeTab !== 'interaction'}
				class:bg-blue-50={activeTab === 'interaction'}
				onclick={() => (activeTab = 'interaction')}
			>
				Interaction
				{#if activeTab === 'interaction'}
					<div class="absolute bottom-0 left-0 h-0.5 w-full bg-blue-600"></div>
				{/if}
			</button>
		</div>

		<div class="relative flex-1 overflow-hidden">
			<div class="absolute inset-0 h-full w-full" class:hidden={activeTab !== 'dataset'}>
				<SidebarDataset />
			</div>

			<div class="absolute inset-0 h-full w-full" class:hidden={activeTab !== 'interaction'}>
				<SidebarInteraction />
			</div>
		</div>
	</div>

	<div
		class="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-slate-100/50 p-4"
	>
		{#if appState.dataset}
			<div class="flex h-full w-full gap-4">
				<div class="h-full flex-1">
					<View3D />
				</div>
				<div class="h-full flex-1">
					<View2D />
				</div>
			</div>
		{:else}
			<div class="flex h-full w-full gap-4">
				<!-- 3D View Placeholder -->
				<div
					class="flex h-full flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-gray-200/60 bg-white/50 shadow-sm backdrop-blur-sm select-none"
				>
					<div
						class="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] opacity-60"
					></div>
					<svg
						class="h-14 w-14 text-gray-300"
						fill="none"
						stroke="currentColor"
						stroke-width="1.2"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"
						/>
					</svg>
					<div class="text-center">
						<p class="text-sm font-medium tracking-wider text-gray-400 uppercase">3D View</p>
						<p class="mt-1 text-xs text-gray-300">Load a dataset to visualize</p>
					</div>
				</div>
				<!-- 2D View Placeholder -->
				<div
					class="relative flex h-full flex-1 flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border border-gray-200/60 bg-white/50 shadow-sm backdrop-blur-sm select-none"
				>
					<div
						class="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] opacity-60"
					></div>
					<svg
						class="h-14 w-14 text-gray-300"
						fill="none"
						stroke="currentColor"
						stroke-width="1.2"
						viewBox="0 0 24 24"
					>
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
						<p class="text-sm font-medium tracking-wider text-gray-400 uppercase">2D View</p>
						<p class="mt-1 text-xs text-gray-300">Load a dataset to visualize</p>
					</div>
				</div>
			</div>
		{/if}
	</div>
</main>
