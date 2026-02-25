<script lang="ts">
	import { appState } from '$lib/stores/app.svelte';
	import SidebarComponent from './SidebarComponent.svelte';
	import Slider from '$lib/components/UI/Slider.svelte';
	import Toggle from '$lib/components/UI/Toggle.svelte';
	import MorphControl from '$lib/components/Controls/MorphControl.svelte';
	import RunControl from '$lib/components/Controls/RunControl.svelte';
</script>

<div class="h-full flex flex-col bg-transparent">
	
	<div class="p-5 border-b border-gray-200/50 bg-white/40 sticky top-0 z-10 backdrop-blur-md">
		<h2 class="text-2xl font-bold tracking-tight text-gray-800">Interaction</h2>
		<p class="text-xs text-gray-400 mt-1">Configure & Steer UMAP</p>
	</div>

	<div class="p-5 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6">

		<SidebarComponent title="Hyperparameters">
			<Slider 
				label="Neighbors" 
				bind:value={appState.params.nNeighbors} 
				min={2} max={100} step={1} 
			/>
			<Slider 
				label="Min Distance" 
				bind:value={appState.params.minDist} 
				min={0} max={1} step={0.01} 
			/>
			<Slider 
				label="Spread" 
				bind:value={appState.params.spread}
				min={0.1} max={5} step={0.1} 
			/>
			<Slider 
				label="Epochs" 
				bind:value={appState.params.nEpochs} 
				min={100} max={2000} step={100} 
			/>
		</SidebarComponent>

		<SidebarComponent title="Steering & Injection">
			<div class="bg-blue-50/50 rounded-lg p-3 border border-blue-100/50">
				<Toggle 
					label="Manual Mode (Steering)" 
					bind:checked={appState.manualMode} 
				/>
				
				{#if appState.manualMode}
					<div class="mt-2 text-xs text-blue-600 bg-blue-100/50 p-2 rounded">
						<p class="font-bold mb-1">How to steer:</p>
						<ul class="list-disc list-inside space-y-0.5 opacity-80">
							<li>Drag points in 2D view</li>
							<li>Click "Re-run UMAP" to inject priors</li>
							<li>Algorithm optimizes with your constraints</li>
						</ul>
					</div>
				{/if}
			</div>
		</SidebarComponent>

		<SidebarComponent title="Analysis & Compare" initiallyExpanded={true}>
			<MorphControl />
			<div class="mt-3 pt-3 border-t border-gray-100">
				<Toggle 
					label="Highlight Unstable Points" 
					bind:checked={appState.ifHighlightUnstablePoints} 
				/>
			</div>
		</SidebarComponent>

	</div>

	<RunControl />
</div>