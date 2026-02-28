<script lang="ts">
	import { appState } from '$lib/stores/app.svelte';

	function formatParams(params: any) {
		if (!params) return 'N/A';
		return `NN:${params.nNeighbors} | Ep:${params.nEpochs}`;
	}

	let prevParams = $derived(appState.history[appState.previousProjectionIdx]?.params);
	let currParams = $derived(appState.history[appState.currentProjectionIdx]?.params);
</script>

<div class="bg-gray-50/80 rounded-lg p-3 border border-gray-200/60 shadow-inner flex flex-col gap-3">

	<!-- Title row -->
	<div class="flex justify-between items-center">
		<h4 class="text-xs font-bold text-gray-500 uppercase tracking-wide">Result Comparison</h4>
		<span class="text-[10px] text-gray-400 font-mono">
			{Math.round(appState.animationProgress * 100)}%
		</span>
	</div>

	<!-- Prev thumbnail + slider + Curr thumbnail -->
	<div class="flex items-center gap-3">

		<!-- Prev -->
		<div class="flex flex-col items-center gap-1 w-12 shrink-0">
			<div class="w-10 h-10 rounded border-2 border-dashed border-blue-400 bg-white overflow-hidden shadow-sm">
				{#if appState.previousProjectionIdx !== -1 && appState.history[appState.previousProjectionIdx]?.thumbnail}
					<img src={appState.history[appState.previousProjectionIdx].thumbnail} class="w-full h-full object-cover" alt="prev" />
				{:else if appState.previousProjectionIdx !== -1}
					<div class="w-full h-full bg-blue-100 text-[8px] flex items-center justify-center text-blue-400">PREV</div>
				{:else}
					<div class="w-full h-full flex items-center justify-center text-gray-300 text-[8px]">None</div>
				{/if}
			</div>
			<span class="text-[8px] text-gray-400 font-mono text-center leading-tight truncate w-full">
				{appState.previousProjectionIdx !== -1 ? `#${appState.previousProjectionIdx}` : '–'}
			</span>
		</div>

		<!-- Slider -->
		<div class="flex-1 flex flex-col justify-center pt-1">
			<input
				type="range"
				bind:value={appState.animationProgress}
				min={0} max={1} step={0.01}
				disabled={appState.previousProjectionIdx === -1}
				class="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600 hover:accent-purple-700 disabled:opacity-50"
			/>
			<div class="flex justify-between mt-1 px-1">
				<span class="text-[9px] text-gray-400">Prev</span>
				<span class="text-[9px] text-gray-400">Curr</span>
			</div>
		</div>

		<!-- Curr -->
		<div class="flex flex-col items-center gap-1 w-12 shrink-0">
			<div class="w-10 h-10 rounded border-2 border-purple-500 bg-white overflow-hidden shadow-md">
				{#if appState.currentProjectionIdx !== -1 && appState.history[appState.currentProjectionIdx]?.thumbnail}
					<img src={appState.history[appState.currentProjectionIdx].thumbnail} class="w-full h-full object-cover" alt="curr" />
				{:else if appState.currentProjectionIdx !== -1}
					<div class="w-full h-full bg-purple-100 text-[8px] flex items-center justify-center text-purple-600">CURR</div>
				{:else}
					<div class="w-full h-full flex items-center justify-center text-gray-300 text-[8px]">Empty</div>
				{/if}
			</div>
			<span class="text-[8px] text-gray-500 font-bold font-mono text-center leading-tight truncate w-full">
				{appState.currentProjectionIdx !== -1 ? `#${appState.currentProjectionIdx}` : '–'}
			</span>
		</div>
	</div>

	<!-- History strip -->
	{#if appState.history.length > 0}
		<div class="flex flex-col gap-1">
			<span class="text-[9px] text-gray-400 uppercase tracking-wide font-semibold">History</span>
			<div class="flex gap-1.5 overflow-x-auto pb-1">
				{#each appState.history as entry, i}
					{@const isCurr = i === appState.currentProjectionIdx}
					{@const isPrev = i === appState.previousProjectionIdx}
					<button
						onclick={() => appState.selectHistoryEntry(i)}
						class="shrink-0 flex flex-col items-center gap-0.5 group"
						title="Run #{i} — {formatParams(entry.params)}"
					>
						<div class="w-9 h-9 rounded overflow-hidden bg-white transition-all"
							class:border-2={isCurr || isPrev}
							class:border={!isCurr && !isPrev}
							class:border-purple-500={isCurr}
							class:border-blue-400={isPrev && !isCurr}
							class:border-dashed={isPrev && !isCurr}
							class:border-gray-200={!isCurr && !isPrev}
							class:group-hover:border-gray-400={!isCurr && !isPrev}
							class:shadow-md={isCurr}
						>
							{#if entry.thumbnail}
								<img src={entry.thumbnail} class="w-full h-full object-cover" alt="#{i}" />
							{:else}
								<div class="w-full h-full flex items-center justify-center text-gray-300 text-[8px] bg-gray-50">#{i}</div>
							{/if}
						</div>
						<span class="text-[7px] font-mono leading-none"
							class:text-purple-600={isCurr}
							class:font-bold={isCurr}
							class:text-blue-400={isPrev && !isCurr}
							class:text-gray-400={!isCurr && !isPrev}
						>#{i}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Params comparison -->
	{#if appState.previousProjectionIdx !== -1}
		<div class="text-[9px] text-gray-400 text-center bg-white/50 rounded py-1 border border-gray-100">
			Comparing: <span class="font-mono">{formatParams(prevParams)}</span>
			<span class="mx-1">→</span>
			<span class="font-mono text-gray-600">{formatParams(currParams)}</span>
		</div>
	{/if}

</div>
