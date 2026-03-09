<script lang="ts">
	let { label, checked = $bindable(), disabled = false } = $props();
</script>

<label class="group flex cursor-pointer items-center justify-between py-2">
	<span class="text-sm font-medium text-gray-700 transition-colors group-hover:text-gray-900"
		>{label}</span
	>

	<div class="relative inline-flex cursor-pointer items-center">
		<input type="checkbox" bind:checked {disabled} class="peer sr-only" />
		<div
			class="peer h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-blue-600 peer-focus:ring-2 peer-focus:ring-blue-300 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"
		></div>
	</div>
</label>
