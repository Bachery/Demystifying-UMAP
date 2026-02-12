<script lang="ts">
	import { appState } from '$lib/stores/app.svelte';
	import SidebarComponent from './SidebarComponent.svelte';
	import Slider from '$lib/components/UI/Slider.svelte';
	import Toggle from '$lib/components/UI/Toggle.svelte';
	import MorphControl from '$lib/components/Controls/MorphControl.svelte';

	// 运行 UMAP 的函数
	function handleRun() {
		if (!appState.dataset) {
			alert("Please load a dataset first.");
			return;
		}

		// 检查是否需要在当前坐标基础上运行 (Steering)
		if (appState.manualMode && appState.draggedPointsIdx.length > 0) {
			// 如果处于手动模式且有点被拖拽了，我们把当前的 embedding 作为初始位置传进去
			// (注意：这里需要把 Proxy 对象转为纯数组)
			const currentEmbedding = $state.snapshot(appState.currentProjectionData);
			appState.runUMAP(currentEmbedding);
		} else {
			// 标准重新运行（随机初始化）
			appState.runUMAP();
		}
	}

	// 简单的重置视角功能
	function handleReset() {
		// 这里未来可以对接 3D/2D 视图的 Reset Camera 方法
		// 目前先留空
	}
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

	<div class="p-4 border-t border-gray-200/50 bg-white/80 backdrop-blur-md">
		
		{#if appState.isCalculating}
			<div class="mb-3 flex justify-between items-center text-xs font-mono text-blue-600 animate-pulse">
				<span>Optimizing...</span>
				<span>{appState.currentEpoch} / {appState.totalEpochs}</span>
			</div>
			<div class="w-full bg-gray-200 rounded-full h-1.5 mb-4 overflow-hidden">
				<div 
					class="bg-blue-600 h-1.5 rounded-full transition-all duration-75" 
					style="width: {(appState.currentEpoch / appState.totalEpochs) * 100}%"
				></div>
			</div>
		{/if}

		<button 
			onclick={handleRun}
			disabled={!appState.dataset || appState.isCalculating}
			class="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold uppercase tracking-wider rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
		>
			{appState.isCalculating ? 'Stop' : (appState.manualMode ? 'Re-run with Priors' : 'Run UMAP')}
		</button>

	</div>
</div>