<script lang="ts">
	import DatasetSelector from './DatasetSelector.svelte';
	import SidebarComponent from './SidebarComponent.svelte';
	import SidebarCategory from './SidebarCategory.svelte';
	import UploadDataset from './UploadDataset.svelte';
	import RunControl from '$lib/components/Controls/RunControl.svelte';
	import { appState } from '$lib/stores/app.svelte';

	const axisLabels = ['X', 'Y', 'Z'] as const;

	let categoryNames = $derived(Object.keys(appState.categoriesInfo));
	let uploadedLabelColumnNames = $derived(appState.uploadedLabelColumnNames);
	let showUploadedControls = $derived(
		appState.isUploadedDataset && Boolean(appState.uploadedTable)
	);
	let dataColumnDraft = $state<[string, string, string]>(['', '', '']);
	let dataColumnError = $state('');
	let hasDistinctDataColumns = $derived(new Set(dataColumnDraft).size === dataColumnDraft.length);

	$effect(() => {
		const selectedColumns = appState.selectedUploadedDataColumns;
		if (selectedColumns) {
			dataColumnDraft = [...selectedColumns] as [string, string, string];
		}
	});

	function handleUploadedLabelChange(event: Event) {
		const select = event.currentTarget as HTMLSelectElement;
		appState.setUploadedLabelColumn(select.value);
	}

	function handleUploadedDataColumnChange(axisIndex: number, value: string) {
		const next = [...dataColumnDraft] as [string, string, string];
		next[axisIndex] = value;
		dataColumnDraft = next;

		if (!next.every(Boolean) || new Set(next).size !== next.length) return;

		try {
			appState.setUploadedDataColumns(next);
			dataColumnError = '';
		} catch (error) {
			console.error(error);
			dataColumnError =
				error instanceof Error ? error.message : 'Failed to switch uploaded data columns.';
		}
	}
</script>

<div class="flex h-full flex-col bg-transparent">
	<div
		class="sticky top-0 z-10 flex items-baseline justify-between border-b border-gray-200/50 bg-white/40 p-5 backdrop-blur-md"
	>
		<h2 class="text-2xl font-bold tracking-tight text-gray-800">Dataset</h2>
		<span class="rounded-md bg-gray-100 px-2 py-1 font-mono text-sm text-gray-500 shadow-inner">
			{appState.dataSize > 0 ? `${appState.dataSize} pts` : 'No data'}
		</span>
	</div>

	<div class="custom-scrollbar flex-1 overflow-x-hidden overflow-y-auto p-5">
		<SidebarComponent title="Data Source">
			<div>
				<UploadDataset />
			</div>

			<div class="my-4 flex items-center gap-3">
				<div class="h-px flex-1 bg-gray-200/80"></div>
				<span class="text-[10px] font-bold tracking-wider text-gray-300 uppercase">
					Built-in Datasets
				</span>
				<div class="h-px flex-1 bg-gray-200/80"></div>
			</div>

			<DatasetSelector />
		</SidebarComponent>

		{#if showUploadedControls}
			<SidebarComponent title="Data Columns">
				<div class="flex flex-col gap-3">
					<p class="text-xs leading-relaxed text-gray-500">
						Switching these columns reloads the uploaded matrix for both the 3D view and UMAP.
					</p>

					{#each axisLabels as axisLabel, axisIndex (axisLabel)}
						<label class="flex flex-col gap-1">
							<span class="text-xs font-semibold text-gray-500">{axisLabel} column</span>
							<select
								value={dataColumnDraft[axisIndex]}
								class="w-full rounded-lg border-gray-300 bg-white/90 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
								onchange={(event) =>
									handleUploadedDataColumnChange(axisIndex, event.currentTarget.value)}
							>
								{#each appState.uploadedNumericColumns as column (column)}
									<option value={column}>{column}</option>
								{/each}
							</select>
						</label>
					{/each}

					{#if !hasDistinctDataColumns}
						<div class="rounded-lg border border-amber-100 bg-amber-50 p-2 text-xs text-amber-700">
							Choose three different data columns.
						</div>
					{/if}

					{#if appState.uploadedSkippedRows > 0}
						<div class="rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs text-gray-500">
							{appState.uploadedSkippedRows} rows were skipped because the selected data columns contained
							non-numeric values.
						</div>
					{/if}

					{#if dataColumnError}
						<div class="rounded-lg border border-red-100 bg-red-50 p-2 text-xs text-red-600">
							{dataColumnError}
						</div>
					{/if}
				</div>
			</SidebarComponent>
		{/if}

		<SidebarComponent title="Labels & Colors">
			{#if uploadedLabelColumnNames.length > 0}
				<div class="mb-4 rounded-lg border border-emerald-100 bg-emerald-50/70 p-3">
					<label
						for="uploaded-label-column"
						class="mb-1 block text-xs font-semibold tracking-wide text-emerald-700 uppercase"
					>
						Active Label Column
					</label>
					<select
						id="uploaded-label-column"
						value={appState.selectedUploadedLabelColumn}
						class="w-full rounded-lg border-emerald-200 bg-white/90 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
						onchange={handleUploadedLabelChange}
					>
						{#each uploadedLabelColumnNames as column (column)}
							<option value={column}>{column}</option>
						{/each}
					</select>
				</div>
			{/if}

			{#if categoryNames.length > 0}
				{#each categoryNames as categoryName (categoryName)}
					<SidebarCategory {categoryName} />
				{/each}
			{:else}
				<div class="py-2 text-sm text-gray-400 italic">
					Load or generate a dataset to inspect label groups.
				</div>
			{/if}
		</SidebarComponent>
	</div>

	<RunControl />
</div>

<style>
	/* Slim custom scrollbar styling. */
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
