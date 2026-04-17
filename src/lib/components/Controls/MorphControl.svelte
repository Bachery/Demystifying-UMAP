<script lang="ts">
	import { appState } from '$lib/stores/app.svelte';
	import type { UMAPParams } from '$lib/algorithms/umap.worker';
	import AnimationExportDialog from '$lib/components/UI/AnimationExportDialog.svelte';
	import {
		downloadBlob,
		getSupportedVideoMimeType,
		normalizeWebmFilename,
		waitForCanvasRedraw
	} from '$lib/utils/screenshot';

	let animationDialogOpen = $state(false);
	let animationFilename = $state('');
	let animationDurationSeconds = $state(1);
	let animationIncludeGrid = $state(false);
	let isSavingAnimation = $state(false);

	function formatParams(params?: UMAPParams) {
		if (!params) return 'N/A';
		return `NN:${params.nNeighbors} | Ep:${params.nEpochs}`;
	}

	function canSaveAnimation() {
		return appState.previousProjectionIdx !== -1 && appState.currentProjectionIdx !== -1;
	}

	function getDefaultAnimationFilename() {
		return `${appState.dataset?.name ?? 'embedding'}_morph.webm`;
	}

	function openAnimationDialog() {
		animationFilename = getDefaultAnimationFilename();
		animationDurationSeconds = 1;
		animationIncludeGrid = false;
		animationDialogOpen = true;
	}

	async function saveAnimation() {
		if (!canSaveAnimation()) return;
		const canvas = document.querySelector('#canvas-2d canvas') as HTMLCanvasElement | null;
		if (!canvas || typeof canvas.captureStream !== 'function') {
			alert('This browser cannot record the 2D canvas.');
			return;
		}
		if (typeof MediaRecorder === 'undefined') {
			alert('This browser does not support video recording.');
			return;
		}

		const safeDurationSeconds = Number.isFinite(animationDurationSeconds)
			? animationDurationSeconds
			: 1;
		const durationMs = Math.max(0.1, safeDurationSeconds) * 1000;
		const previousProgress = appState.animationProgress;
		const previousShowGrid = appState.showGrid2D;
		const mimeType = getSupportedVideoMimeType();
		const chunks: BlobPart[] = [];
		let stream: MediaStream | null = null;

		isSavingAnimation = true;
		try {
			appState.showGrid2D = animationIncludeGrid;
			appState.animationProgress = 0;
			await waitForCanvasRedraw();

			stream = canvas.captureStream(60);
			const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
			const stopped = new Promise<Blob>((resolve, reject) => {
				recorder.ondataavailable = (event) => {
					if (event.data.size > 0) chunks.push(event.data);
				};
				recorder.onerror = () => reject(new Error('Video recording failed.'));
				recorder.onstop = () =>
					resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'video/webm' }));
			});

			recorder.start();
			const startTime = performance.now();
			await new Promise<void>((resolve) => {
				const step = (now: number) => {
					const progress = Math.min(1, (now - startTime) / durationMs);
					appState.animationProgress = progress;
					if (progress < 1) {
						requestAnimationFrame(step);
					} else {
						resolve();
					}
				};
				requestAnimationFrame(step);
			});
			await waitForCanvasRedraw();
			recorder.stop();
			const blob = await stopped;
			downloadBlob(blob, normalizeWebmFilename(animationFilename, getDefaultAnimationFilename()));
			animationDialogOpen = false;
		} finally {
			if (stream) {
				for (const track of stream.getTracks()) track.stop();
			}
			appState.animationProgress = previousProgress;
			appState.showGrid2D = previousShowGrid;
			isSavingAnimation = false;
		}
	}

	let prevParams = $derived(appState.history[appState.previousProjectionIdx]?.params);
	let currParams = $derived(appState.history[appState.currentProjectionIdx]?.params);
	let prevEntry = $derived(appState.history[appState.previousProjectionIdx]);
	let currEntry = $derived(appState.history[appState.currentProjectionIdx]);

	let paramRows = $derived([
		{ label: 'NN', prev: prevParams?.nNeighbors, curr: currParams?.nNeighbors },
		{ label: 'minDist', prev: prevParams?.minDist, curr: currParams?.minDist },
		{ label: 'Spread', prev: prevParams?.spread ?? 1.0, curr: currParams?.spread ?? 1.0 },
		{ label: 'Epochs', prev: prevParams?.nEpochs, curr: currParams?.nEpochs },
		{
			label: 'Steered',
			prev: prevEntry?.steered ?? false,
			curr: currEntry?.steered ?? false,
			isBool: true as const
		}
	]);
</script>

<div
	class="flex flex-col gap-3 rounded-lg border border-gray-200/60 bg-gray-50/80 p-3 shadow-inner"
>
	<!-- Comparison header -->
	<div class="flex items-center justify-between">
		<h4 class="text-xs font-bold tracking-wide text-gray-500 uppercase">Result Comparison</h4>
		<div class="flex items-center gap-2">
			<button
				class="rounded bg-purple-100 px-2 py-0.5 text-[9px] font-bold tracking-wide text-purple-700 uppercase transition-colors hover:bg-purple-200 disabled:cursor-not-allowed disabled:opacity-40"
				disabled={!canSaveAnimation() || isSavingAnimation}
				onclick={openAnimationDialog}
			>
				Save Animation
			</button>
			<span class="font-mono text-[10px] text-gray-400">
				{Math.round(appState.animationProgress * 100)}%
			</span>
		</div>
	</div>

	<!-- Comparison scrubber -->
	<div class="flex items-center gap-2">
		<!-- Previous result thumbnail -->
		<div class="flex w-16 shrink-0 flex-col items-center gap-1">
			<div
				class="h-16 w-16 overflow-hidden rounded border-2 border-dashed border-blue-400 bg-white shadow-sm"
			>
				{#if appState.previousProjectionIdx !== -1 && appState.history[appState.previousProjectionIdx]?.thumbnail}
					<img
						src={appState.history[appState.previousProjectionIdx].thumbnail}
						class="h-full w-full object-cover"
						alt="prev"
					/>
				{:else if appState.previousProjectionIdx !== -1}
					<div
						class="flex h-full w-full items-center justify-center bg-blue-100 text-[8px] text-blue-400"
					>
						PREV
					</div>
				{:else}
					<div class="flex h-full w-full items-center justify-center text-[8px] text-gray-300">
						None
					</div>
				{/if}
			</div>
			<span class="w-full truncate text-center font-mono text-[9px] leading-tight text-gray-400">
				{appState.previousProjectionIdx !== -1 ? `#${appState.previousProjectionIdx}` : '–'}
			</span>
		</div>

		<!-- Morph slider -->
		<div class="flex min-w-0 flex-[0.9] flex-col justify-center pt-1">
			<input
				type="range"
				bind:value={appState.animationProgress}
				min={0}
				max={1}
				step={0.01}
				disabled={appState.previousProjectionIdx === -1}
				class="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gray-300 accent-purple-500 hover:accent-purple-700 disabled:opacity-50"
			/>
			<div class="mt-1 flex justify-between px-1">
				<span class="text-[9px] text-gray-400">Prev</span>
				<span class="text-[9px] text-gray-400">Curr</span>
			</div>
		</div>

		<!-- Current result thumbnail -->
		<div class="flex w-16 shrink-0 flex-col items-center gap-1">
			<div class="h-16 w-16 overflow-hidden rounded border-2 border-purple-500 bg-white shadow-md">
				{#if appState.currentProjectionIdx !== -1 && appState.history[appState.currentProjectionIdx]?.thumbnail}
					<img
						src={appState.history[appState.currentProjectionIdx].thumbnail}
						class="h-full w-full object-cover"
						alt="curr"
					/>
				{:else if appState.currentProjectionIdx !== -1}
					<div
						class="flex h-full w-full items-center justify-center bg-purple-100 text-[8px] text-purple-600"
					>
						CURR
					</div>
				{:else}
					<div class="flex h-full w-full items-center justify-center text-[8px] text-gray-300">
						Empty
					</div>
				{/if}
			</div>
			<span
				class="w-full truncate text-center font-mono text-[9px] leading-tight font-bold text-gray-500"
			>
				{appState.currentProjectionIdx !== -1 ? `#${appState.currentProjectionIdx}` : '–'}
			</span>
		</div>
	</div>

	<!-- History thumbnails -->
	{#if appState.history.length > 0}
		<div class="flex flex-col gap-1">
			<span class="text-[9px] font-semibold tracking-wide text-gray-400 uppercase">History</span>
			<div
				class="flex gap-1.5 overflow-x-auto pb-1"
				onwheel={(e) => {
					e.preventDefault();
					e.currentTarget.scrollLeft += e.deltaY;
				}}
			>
				{#each appState.history as entry, i (i)}
					{@const isCurr = i === appState.currentProjectionIdx}
					{@const isPrev = i === appState.previousProjectionIdx}
					<button
						onclick={() => appState.selectHistoryEntry(i)}
						class="group flex shrink-0 flex-col items-center gap-0.5"
						title="Run #{i} — {formatParams(entry.params)}{entry.steered ? ' [Steered]' : ''}"
					>
						<div
							class="relative h-9 w-9 overflow-hidden rounded bg-white transition-all"
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
								<img src={entry.thumbnail} class="h-full w-full object-cover" alt="#{i}" />
							{:else}
								<div
									class="flex h-full w-full items-center justify-center bg-gray-50 text-[8px] text-gray-300"
								>
									#{i}
								</div>
							{/if}
							{#if entry.steered}
								<div
									class="absolute right-0 bottom-0 rounded-tl bg-orange-400 px-0.5 text-[6px] leading-tight text-white"
								>
									✎
								</div>
							{/if}
						</div>
						<span
							class="font-mono text-[7px] leading-none"
							class:text-purple-600={isCurr}
							class:font-bold={isCurr}
							class:text-blue-400={isPrev && !isCurr}
							class:text-gray-400={!isCurr && !isPrev}>#{i}</span
						>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Parameter comparison -->
	{#if appState.previousProjectionIdx !== -1}
		<div class="overflow-hidden rounded border border-gray-100 bg-white/50">
			<div class="grid grid-cols-[auto_1fr_1fr] font-mono text-[9px]">
				<div
					class="border-b border-gray-100 bg-gray-50/80 px-2 py-0.5 font-sans font-semibold tracking-wide text-gray-400 uppercase"
				></div>
				<div
					class="border-b border-l border-gray-100 bg-gray-50/80 px-2 py-0.5 text-center font-bold text-blue-400"
				>
					#{appState.previousProjectionIdx}
				</div>
				<div
					class="border-b border-l border-gray-100 bg-gray-50/80 px-2 py-0.5 text-center font-bold text-purple-600"
				>
					#{appState.currentProjectionIdx}
				</div>

				{#each paramRows as row (row.label)}
					{@const changed = row.prev !== row.curr}
					<div class="px-2 py-0.5 font-sans text-gray-400" class:bg-yellow-50={changed}>
						{row.label}
					</div>
					{#if row.isBool}
						<div
							class="border-l border-gray-100 px-2 py-0.5 text-center"
							class:bg-yellow-50={changed}
							class:text-orange-500={row.prev}
							class:text-gray-300={!row.prev}
						>
							{row.prev ? '✎ yes' : '–'}
						</div>
						<div
							class="border-l border-gray-100 px-2 py-0.5 text-center"
							class:bg-yellow-50={changed}
							class:text-orange-500={row.curr}
							class:text-gray-300={!row.curr}
						>
							{row.curr ? '✎ yes' : '–'}
						</div>
					{:else}
						<div
							class="border-l border-gray-100 px-2 py-0.5 text-center text-blue-400"
							class:bg-yellow-50={changed}
							class:font-bold={changed}
						>
							{row.prev ?? '–'}
						</div>
						<div
							class="border-l border-gray-100 px-2 py-0.5 text-center text-purple-600"
							class:bg-yellow-50={changed}
							class:font-bold={changed}
						>
							{row.curr ?? '–'}
						</div>
					{/if}
				{/each}
			</div>
		</div>
	{/if}
</div>

<AnimationExportDialog
	open={animationDialogOpen}
	filename={animationFilename}
	durationSeconds={animationDurationSeconds}
	includeGrid={animationIncludeGrid}
	saving={isSavingAnimation}
	onCancel={() => (animationDialogOpen = false)}
	onFilenameChange={(value) => (animationFilename = value)}
	onDurationChange={(value) => (animationDurationSeconds = value)}
	onIncludeGridChange={(value) => (animationIncludeGrid = value)}
	onSave={saveAnimation}
/>
