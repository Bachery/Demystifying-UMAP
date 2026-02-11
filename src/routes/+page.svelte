<script lang="ts">
	// 引入我们写好的侧边栏组件
	import SidebarDataset from '$lib/components/Controls/SidebarDataset.svelte';
</script>

<svelte:head>
	<title>UMAP Diagnostics</title>
</svelte:head>

<main class="w-screen h-screen overflow-hidden flex bg-gray-50/50 font-sans text-gray-800">
	
	<div class="h-full z-10 relative shadow-[4px_0_24px_rgba(0,0,0,0.05)]">
		<SidebarDataset />
	</div>

	<div class="flex-1 relative flex flex-col items-center justify-center bg-slate-100/50 overflow-hidden">
		
		<div class="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-50"></div>
		
		<div class="relative z-10 flex flex-col items-center">
			<svg class="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"></path></svg>
			<h1 class="text-gray-400 font-medium text-xl tracking-widest uppercase">
				3D & 2D Visualization Canvas
			</h1>
			<p class="text-gray-400 text-sm mt-2">
				Select a dataset from the sidebar to begin
			</p>
		</div>
		
	</div>
</main>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		overflow: hidden;
	}
</style>