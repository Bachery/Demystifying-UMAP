<script lang="ts">
	import { appState } from '$lib/stores/app.svelte';
	import SidebarComponent from './SidebarComponent.svelte';
	import Slider from '$lib/components/UI/Slider.svelte';
	import Toggle from '$lib/components/UI/Toggle.svelte';
	import MorphControl from '$lib/components/Controls/MorphControl.svelte';
	import RunControl from '$lib/components/Controls/RunControl.svelte';
</script>

<div class="flex h-full flex-col bg-transparent">
	<div class="sticky top-0 z-10 border-b border-gray-200/50 bg-white/40 p-5 backdrop-blur-md">
		<h2 class="text-2xl font-bold tracking-tight text-gray-800">Interaction</h2>
		<p class="mt-1 text-xs text-gray-400">Configure & Steer UMAP</p>
	</div>

	<div class="custom-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-5">
		<SidebarComponent title="Hyperparameters">
			<Slider
				label="Neighbors"
				bind:value={appState.params.nNeighbors}
				min={2}
				max={500}
				step={1}
			/>
			<Slider
				label="Min Distance"
				bind:value={appState.params.minDist}
				min={0}
				max={1}
				step={0.01}
			/>
			<Slider label="Spread" bind:value={appState.params.spread} min={0.1} max={5} step={0.1} />
			<Slider label="Epochs" bind:value={appState.params.nEpochs} min={100} max={2000} step={100} />
		</SidebarComponent>

		<SidebarComponent title="Steering & Injection">
			<div class="rounded-lg border border-blue-100/50 bg-blue-50/50 p-3">
				<Toggle label="Manual Mode (Steering)" bind:checked={appState.manualMode} />

				{#if appState.manualMode}
					<div class="mt-2 rounded bg-blue-100/50 p-2 text-xs text-blue-600">
						<p class="mb-1 font-bold">How to steer in 2D Panel:</p>
						<ul class="list-inside list-disc space-y-0.5 opacity-80">
							<li><strong>Click</strong> a point to select/deselect its cluster</li>
							<li><strong>Hold 'Shift'</strong> to activate box selection</li>
							<li><strong>Drag</strong> selected points to new positions</li>
							<li>Click "Re-run" to inject priors</li>
						</ul>
					</div>
				{/if}
			</div>
		</SidebarComponent>

		<SidebarComponent title="Analysis & Compare" initiallyExpanded={true}>
			<MorphControl />
			<div class="mt-2 border-t border-gray-100 pt-2">
				<Toggle
					label="Highlight Unstable Points"
					bind:checked={appState.ifHighlightUnstablePoints}
				/>
			</div>
		</SidebarComponent>
	</div>

	<RunControl />
</div>

<style>
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
