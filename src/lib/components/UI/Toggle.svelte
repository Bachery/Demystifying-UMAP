<script lang="ts">
	let { label, checked = $bindable(), disabled = false } = $props();
</script>

<label class="flex items-center justify-between cursor-pointer group py-2">
	<span class="text-sm text-gray-700 font-medium group-hover:text-gray-900 transition-colors">{label}</span>
	
	<div class="relative inline-flex items-center cursor-pointer">
		<input type="checkbox" bind:checked={checked} {disabled} class="sr-only peer">
		<div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
	</div>
</label>