<script lang="ts">
	import { slide } from 'svelte/transition';

	let { title, initiallyExpanded = true, children } = $props();

	// svelte-ignore state_referenced_locally
	let isExpanded = $state(initiallyExpanded);
</script>

<div
	class="mb-3 overflow-hidden rounded-xl border border-gray-200/50 bg-white/40 shadow-sm backdrop-blur-sm transition-all hover:shadow-md"
>
	<button
		class="flex w-full items-center justify-between px-4 py-3 text-left focus:outline-none"
		onclick={() => (isExpanded = !isExpanded)}
	>
		<h3 class="font-semibold text-gray-700">{title}</h3>
		<span
			class="transform text-sm text-gray-400 transition-transform duration-300"
			class:rotate-90={isExpanded}
		>
			▶
		</span>
	</button>

	{#if isExpanded}
		<div class="px-4 pb-4 text-sm text-gray-600" transition:slide={{ duration: 200 }}>
			{@render children()}
		</div>
	{/if}
</div>
