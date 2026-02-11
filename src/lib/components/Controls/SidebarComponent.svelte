<script lang="ts">
	import { slide } from 'svelte/transition';
	
	// Svelte 5 接收 props 的新写法
	let { title, initiallyExpanded = true, children } = $props();
	
	// svelte-ignore state_referenced_locally
	let isExpanded = $state(initiallyExpanded);
</script>

<div class="mb-3 rounded-xl border border-gray-200/50 bg-white/40 backdrop-blur-sm overflow-hidden shadow-sm transition-all hover:shadow-md">
	<button 
		class="w-full px-4 py-3 flex justify-between items-center text-left focus:outline-none"
		onclick={() => isExpanded = !isExpanded}
	>
		<h3 class="font-semibold text-gray-700">{title}</h3>
		<span class="transform transition-transform duration-300 text-gray-400 text-sm" 
			class:rotate-90={isExpanded}>
			▶
		</span>
	</button>
	
	{#if isExpanded}
		<div class="px-4 pb-4 text-sm text-gray-600" transition:slide={{duration: 200}}>
			{@render children()}
		</div>
	{/if}
</div>