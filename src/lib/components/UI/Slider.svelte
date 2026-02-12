<script lang="ts">
	let { label, value = $bindable(), min, max, step = 1, disabled = false } = $props();
</script>

<div class="flex flex-col gap-1 mb-3">
	<div class="flex justify-between items-center">
		<label for="Slider-input-{label}" class="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>
		<input 
			type="number" 
			bind:value={value} 
			{min} {max} {step} {disabled}
			class="w-12 text-xs text-right py-0.5 px-1 rounded border border-gray-200 text-gray-700 font-mono focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
		/>
	</div>
	<div class="relative h-4 flex items-center">
		<input 
			type="range" 
			bind:value={value} 
			{min} {max} {step} {disabled}
			class="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-700 disabled:opacity-50"
		/>
	</div>
</div>