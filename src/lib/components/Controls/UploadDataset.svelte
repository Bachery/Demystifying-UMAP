<script lang="ts">
	import { appState } from '$lib/stores/app.svelte';
	import {
		buildUploadedDataset,
		createUploadedTable,
		getNumericColumnNames,
		parseDelimitedFile,
		type ParsedDelimitedFile,
		type UploadedTable
	} from '$lib/utils/uploadedDataset';

	let fileInput: HTMLInputElement | null = $state(null);
	let parsedFile = $state<ParsedDelimitedFile | null>(null);
	let table = $state<UploadedTable | null>(null);
	let hasHeader = $state(false);
	let isDialogOpen = $state(false);
	let errorMessage = $state('');
	let selectedLabelLookup = $state<Record<string, boolean>>({});
	let dataColumns = $state<[string, string, string]>(['', '', '']);

	let numericColumns = $derived(table ? getNumericColumnNames(table) : []);
	let selectedLabelColumns = $derived(
		Object.keys(selectedLabelLookup).filter((column) => selectedLabelLookup[column])
	);
	let hasDistinctDataColumns = $derived(new Set(dataColumns).size === dataColumns.length);
	let canImport = $derived(Boolean(table) && dataColumns.every(Boolean) && hasDistinctDataColumns);

	const axisLabels = ['X', 'Y', 'Z'];

	function portal(node: HTMLElement) {
		if (typeof document !== 'undefined') {
			document.body.appendChild(node);
		}

		return {
			destroy() {
				node.remove();
			}
		};
	}

	function openFilePicker() {
		fileInput?.click();
	}

	async function handleFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		try {
			errorMessage = '';
			const text = await file.text();
			parsedFile = parseDelimitedFile(text, file.name);
			hasHeader = parsedFile.detectedHasHeader;
			resetTableFromHeaderChoice();
			isDialogOpen = true;
		} catch (error) {
			console.error(error);
			errorMessage = error instanceof Error ? error.message : 'Failed to parse the selected file.';
		} finally {
			input.value = '';
		}
	}

	function resetTableFromHeaderChoice() {
		if (!parsedFile) return;

		try {
			table = createUploadedTable(parsedFile, hasHeader);
			const nextNumericColumns = getNumericColumnNames(table);
			const defaultDataColumns = nextNumericColumns.slice(0, 3);
			dataColumns = [
				defaultDataColumns[0] ?? '',
				defaultDataColumns[1] ?? '',
				defaultDataColumns[2] ?? ''
			];

			const selectedLabelColumn =
				table.columns.find((column) => !dataColumns.includes(column)) ?? table.columns[0];
			selectedLabelLookup = Object.fromEntries(
				table.columns.map((column) => [column, column === selectedLabelColumn])
			);
			errorMessage = '';
		} catch (error) {
			console.error(error);
			table = null;
			selectedLabelLookup = {};
			dataColumns = ['', '', ''];
			errorMessage = error instanceof Error ? error.message : 'Failed to parse the selected file.';
		}
	}

	function handleHeaderChange(checked: boolean) {
		hasHeader = checked;
		resetTableFromHeaderChoice();
	}

	function handleLabelToggle(column: string, checked: boolean) {
		selectedLabelLookup = {
			...selectedLabelLookup,
			[column]: checked
		};
	}

	function handleDataColumnChange(axisIndex: number, value: string) {
		const next = [...dataColumns] as [string, string, string];
		next[axisIndex] = value;
		dataColumns = next;
	}

	function closeDialog() {
		isDialogOpen = false;
	}

	function importDataset() {
		if (!table || !canImport) return;

		try {
			const bundle = buildUploadedDataset(table, {
				labelColumns: selectedLabelColumns,
				selectedLabelColumn: selectedLabelColumns[0],
				dataColumns
			});
			appState.setUploadedDataset(bundle);
			isDialogOpen = false;
			errorMessage = '';
		} catch (error) {
			console.error(error);
			errorMessage =
				error instanceof Error ? error.message : 'Failed to import the selected columns.';
		}
	}

	function delimiterLabel(delimiter: string) {
		if (delimiter === '\t') return 'tab';
		if (delimiter === ';') return 'semicolon';
		return 'comma';
	}
</script>

<div class="flex flex-col gap-2">
	<input
		bind:this={fileInput}
		type="file"
		accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
		class="hidden"
		onchange={handleFileChange}
	/>

	<div class="flex items-center gap-2">
		<button
			type="button"
			onclick={openFilePicker}
			class="flex-1 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs font-bold tracking-wider text-emerald-700 uppercase shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-100 active:scale-[0.99]"
		>
			Upload Local Data
		</button>

		<div class="group relative">
			<span
				class="flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border border-gray-300 text-[10px] text-gray-400 select-none"
				>?</span
			>
			<div
				class="pointer-events-none absolute right-0 bottom-full z-50 mb-2 hidden w-44 rounded bg-gray-800 p-2 text-xs text-white shadow-lg group-hover:block"
			>
				Supports .csv, .tsv, and .txt files.
				<div class="absolute top-full right-1 border-4 border-transparent border-t-gray-800"></div>
			</div>
		</div>
	</div>

	{#if errorMessage && !isDialogOpen}
		<div class="rounded-lg border border-red-100 bg-red-50 p-2 text-xs text-red-600">
			{errorMessage}
		</div>
	{/if}
</div>

{#if isDialogOpen && table}
	<div
		use:portal
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-sm"
		onclick={closeDialog}
		role="presentation"
	>
		<div
			class="max-h-[88vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl"
			onclick={(event) => event.stopPropagation()}
			onkeydown={(event) => event.stopPropagation()}
			role="dialog"
			aria-modal="true"
			aria-labelledby="upload-dialog-title"
			tabindex="-1"
		>
			<div class="border-b border-gray-100 px-5 py-4">
				<div class="flex items-start justify-between gap-4">
					<div>
						<h3 id="upload-dialog-title" class="text-lg font-bold text-gray-800">
							Import Uploaded Data
						</h3>
						<p class="mt-1 text-xs text-gray-500">
							{table.fileName} | {table.rows.length} rows | {table.columns.length} columns |
							{delimiterLabel(table.delimiter)} separated
						</p>
					</div>
					<button
						type="button"
						class="rounded-full px-2 py-1 text-lg leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-600"
						onclick={closeDialog}
						aria-label="Close import dialog"
					>
						x
					</button>
				</div>

				<label class="mt-4 flex items-center gap-2 text-sm text-gray-700">
					<input
						type="checkbox"
						checked={hasHeader}
						class="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
						onchange={(event) => handleHeaderChange(event.currentTarget.checked)}
					/>
					First row contains column names
				</label>
			</div>

			<div class="custom-scrollbar max-h-[58vh] overflow-y-auto px-5 py-4">
				<div class="grid gap-5 md:grid-cols-[1.15fr_0.85fr]">
					<div>
						<h4 class="mb-2 text-xs font-bold tracking-wider text-gray-400 uppercase">
							Label Columns
						</h4>
						<p class="mb-3 text-xs leading-relaxed text-gray-500">
							Label columns are optional. Selected columns will be available in <b
								>Labels & Colors</b
							>
							after import.
						</p>
						<div class="grid max-h-72 gap-2 overflow-y-auto pr-1">
							{#each table.columns as column, index (column)}
								<label
									class="flex items-center gap-2 rounded-lg border border-gray-200/70 bg-gray-50/70 px-3 py-2 text-sm text-gray-700 hover:border-emerald-200 hover:bg-emerald-50/60"
								>
									<input
										type="checkbox"
										checked={selectedLabelLookup[column] ?? false}
										class="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
										onchange={(event) => handleLabelToggle(column, event.currentTarget.checked)}
									/>
									<span class="min-w-8 font-mono text-xs text-gray-400">#{index}</span>
									<span class="truncate">{column}</span>
								</label>
							{/each}
						</div>
					</div>

					<div>
						<h4 class="mb-2 text-xs font-bold tracking-wider text-gray-400 uppercase">
							3 Data Columns
						</h4>
						<p class="mb-3 text-xs leading-relaxed text-gray-500">
							These numeric columns become the 3D coordinates and the UMAP source matrix.
						</p>

						<div class="flex flex-col gap-3">
							{#each axisLabels as axisLabel, axisIndex (axisLabel)}
								<label class="flex flex-col gap-1">
									<span class="text-xs font-semibold text-gray-500">{axisLabel} column</span>
									<select
										value={dataColumns[axisIndex]}
										class="w-full rounded-lg border-gray-300 bg-white text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
										onchange={(event) =>
											handleDataColumnChange(axisIndex, event.currentTarget.value)}
									>
										<option value="">Choose numeric column</option>
										{#each numericColumns as column (column)}
											<option value={column}>{column}</option>
										{/each}
									</select>
								</label>
							{/each}
						</div>

						{#if numericColumns.length < 3}
							<div class="mt-3 rounded-lg border border-red-100 bg-red-50 p-2 text-xs text-red-600">
								This file needs at least three fully numeric columns.
							</div>
						{:else if !hasDistinctDataColumns}
							<div
								class="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-2 text-xs text-amber-700"
							>
								Choose three different data columns.
							</div>
						{/if}
					</div>
				</div>

				{#if errorMessage}
					<div class="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">
						{errorMessage}
					</div>
				{/if}
			</div>

			<div class="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-4">
				<button
					type="button"
					onclick={closeDialog}
					class="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 shadow-sm hover:bg-gray-50"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={importDataset}
					disabled={!canImport}
					class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:bg-gray-300"
				>
					Import Data
				</button>
			</div>
		</div>
	</div>
{/if}

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
</style>
