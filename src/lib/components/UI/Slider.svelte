<script lang="ts">
	let { label, value = $bindable(), min, max, step = 1, disabled = false } = $props();
	let inputId = $derived.by(
		() =>
			`slider-${String(label)
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')}`
	);
</script>

<div class="mb-2 flex flex-col gap-1">
	<div class="flex items-center justify-between">
		<label for={inputId} class="text-xs font-medium tracking-wide text-gray-500 uppercase"
			>{label}</label
		>
		<input
			id={inputId}
			type="number"
			bind:value
			{min}
			{max}
			{step}
			{disabled}
			class="w-16 rounded border border-gray-200 px-1 py-0.5 text-right font-mono text-xs text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
		/>
	</div>
	<div class="relative flex h-4 items-center">
		<input
			type="range"
			bind:value
			{min}
			{max}
			{step}
			{disabled}
			class="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-blue-600 hover:accent-blue-700 disabled:opacity-50"
		/>
	</div>
</div>
