<script lang="ts">
	import { appState } from '$lib/stores/app.svelte';
	import * as Generators from '$lib/algorithms/generators';
	import { DatasetLoader } from '$lib/algorithms/loader';
	import type {
		DatasetResult as GeneratedDatasetResult,
		GeneratorSettings
	} from '$lib/algorithms/generators';

	type GeneratorParams = Record<string, number>;
	type GeneratedDatasetType = 'continuous' | 'categorical';
	type DatasetConfig = {
		description?: string;
		loadable?: boolean;
		defaultParams?: GeneratorParams;
		generatedType?: GeneratedDatasetType;
	};
	type BlobConfig = {
		num_samples: number;
		mean: [number, number, number];
		std: number;
	};

	const DATASET_CONFIG: Record<string, DatasetConfig> = {
		'Antipodal-Clusters': {
			description:
				'<b>Case 1 (Initialization Sensitivity):</b> Symmetric clusters arranged around a center. Default UMAP often loses global symmetry, placing opposite pairs on the same side. Use <i>Manual Mode</i> to restore the correct antipodal alignment.',
			loadable: true,
			generatedType: 'categorical'
		},
		'Enclosed-Blob': {
			description:
				'<b>Case 3 (Multi-scale Topology):</b> A dense core surrounded by a spherical shell. Low <code>n_neighbors</code> treats them as disjoint clusters, while high values reveal the global nesting (enclosure) relationship.',
			loadable: true,
			defaultParams: { num_inner: 5000, num_outer: 2000, radius: 10.0 },
			generatedType: 'categorical'
		},
		'Two-Moons': {
			description:
				'<b>Case 2 (Topological Tearing):</b> Two interleaved continuous manifolds. Due to spatial proximity, UMAP may incorrectly fragment (tear) the crescents or merge them. Check for continuity against the 3D ground truth.',
			loadable: true,
			defaultParams: { num_samples: 5000, noise: 0.17 },
			generatedType: 'categorical'
		},
		'Swiss-Roll': {
			description:
				'<b>Unfolding Test:</b> A classic curled manifold. UMAP aims to "unroll" this into a flat strip. Watch for topological tears (holes in the strip) or incomplete unfolding.',
			loadable: true,
			defaultParams: { num_samples: 5000, noise: 1.0 },
			generatedType: 'continuous'
		},
		'Uniform-Strip': {
			description:
				'<b>Continuity Test:</b> A simple, long continuous strip. A baseline for testing fragmentation. If <code>n_neighbors</code> is low, the single manifold may break into multiple artificial islands.',
			loadable: true,
			defaultParams: { num_samples: 5000, length: 15.0, width: 1.0 },
			generatedType: 'continuous'
		},
		'Torus-Surface': {
			description:
				'<b>Case 4 (Genus Preservation):</b> A closed surface with a central hole (genus-1). Standard settings often collapse the hole or tear the loop. Preserving the hole requires balancing global structure against local compactness.',
			loadable: true,
			defaultParams: { num_samples: 5000, ring_radius: 10.0, tube_radius: 7.9 },
			generatedType: 'categorical'
		},
		'S-Curve': {
			description:
				'<b>Intrinsic vs. Extrinsic:</b> An S-shaped curve. UMAP typically straightens/flattens it. This demonstrates how the algorithm preserves intrinsic neighborhood relationships while discarding extrinsic 3D curvature.',
			loadable: true,
			defaultParams: { num_samples: 5000, noise: 0.33 },
			generatedType: 'continuous'
		},
		'Density-Contrast': {
			description:
				'<b>Metric Distortion:</b> Two clusters with significantly different densities. UMAP normalizes local connectivity, causing sparse and dense clusters to appear visually similar in size. Density cues are often lost.',
			loadable: true,
			generatedType: 'categorical'
		},
		'Distance-Contrast': {
			description:
				'<b>Global Distance Distortion:</b> Clusters with varying inter-cluster distances. UMAP is not isometric; global distances in the 2D embedding do not linearly reflect the absolute separation in 3D space.',
			loadable: true,
			generatedType: 'categorical'
		},
		'Connected-Blobs': {
			description:
				'<b>Case 5 (Density Fragility):</b> Dense clusters linked by a sparse bridge. A stress test for density sensitivity: surprisingly, increasing <code>n_neighbors</code> (global optimization) may cause the weak bridge to snap and be absorbed by the dense clusters.',
			loadable: true,
			defaultParams: { bridge_samples: 500, cov_bridge: 0.7 },
			generatedType: 'categorical'
		},
		WorldMap: {
			loadable: true,
			generatedType: 'categorical'
		},
		WorldMapRoll: {
			loadable: true,
			generatedType: 'categorical'
		},
		WorldMapGlobe: {
			loadable: true,
			generatedType: 'categorical'
		},
		'Gaussian-Blobs': {
			description:
				'Standard Gaussian clusters. Use this to verify basic cluster separation and to test how initialization affects the relative positioning of distinct groups.',
			generatedType: 'categorical'
		}
	};

	const datasetNames = Object.keys(DATASET_CONFIG);

	let selectedDataset = $state('');
	let isLoading = $state(false);
	let isGenerating = $state(false);
	let currentParams = $state<GeneratorParams>({});
	let blobs = $state<BlobConfig[]>([
		{ num_samples: 1000, mean: [10, 0, 0], std: 0.8 },
		{ num_samples: 1000, mean: [0, 10, 0], std: 0.8 },
		{ num_samples: 1000, mean: [0, 0, 10], std: 0.8 }
	]);

	let selectedConfig = $derived(DATASET_CONFIG[selectedDataset] ?? null);

	$effect(() => {
		const defaultParams = selectedConfig?.defaultParams;
		currentParams = defaultParams ? { ...defaultParams } : {};
	});

	function addBlob() {
		blobs.push({ num_samples: 2000, mean: [0, 0, 0], std: 0.8 });
	}

	function removeBlob(index: number) {
		if (blobs.length > 1) {
			blobs = blobs.filter((_, i) => i !== index);
		}
	}

	async function handleLoad() {
		if (!selectedDataset) return;
		isLoading = true;
		try {
			const loader = new DatasetLoader();
			const result = await loader.load(selectedDataset);
			appState.setDataset({ ...result, source: 'local' });
		} catch (error) {
			console.error(error);
			alert(`Failed to load ${selectedDataset}`);
		} finally {
			isLoading = false;
		}
	}

	function generateDataset(name: string, params: GeneratorParams): GeneratedDatasetResult | null {
		switch (name) {
			case 'Swiss-Roll':
				return Generators.generateSwissRoll(params as GeneratorSettings);
			case 'Two-Moons':
				return Generators.generateTwoMoons(params as GeneratorSettings);
			case 'Enclosed-Blob':
				return Generators.generateEnclosedBlob(
					params as { num_inner: number; num_outer: number; radius: number }
				);
			case 'Connected-Blobs':
				return Generators.generateConnectedBlobs(
					params as { bridge_samples: number; cov_bridge: number }
				);
			case 'S-Curve':
				return Generators.generateSCurve(params as GeneratorSettings);
			case 'Torus-Surface':
				return Generators.generateTorus(
					params as { num_samples: number; ring_radius: number; tube_radius: number }
				);
			case 'Uniform-Strip':
				return Generators.generateUniformStrip(
					params as { num_samples: number; length: number; width: number }
				);
			default:
				console.warn('No generator found for', name);
				return null;
		}
	}

	async function handleGenerate() {
		if (!selectedDataset) return;
		isGenerating = true;
		try {
			await new Promise((resolve) => setTimeout(resolve, 10));

			let result: GeneratedDatasetResult | null = null;
			if (selectedDataset === 'Gaussian-Blobs') {
				result = Generators.generateMultipleBlobs({
					blobs: $state.snapshot(blobs)
				});
			} else {
				result = generateDataset(selectedDataset, $state.snapshot(currentParams));
			}

			if (result && selectedConfig?.generatedType) {
				appState.setDataset({
					...result,
					name: selectedDataset,
					type: selectedConfig.generatedType,
					source: 'generated'
				});
			}
		} catch (error) {
			console.error(error);
			alert('Generation failed, check console.');
		} finally {
			isGenerating = false;
		}
	}
</script>

<div class="flex flex-col gap-4">
	<div class="relative">
		<label
			for="dataset-select"
			class="mb-1 block text-xs font-medium tracking-wide text-gray-500 uppercase"
			>Select Dataset</label
		>
		<select
			id="dataset-select"
			bind:value={selectedDataset}
			class="w-full rounded-lg border-gray-300 bg-white/80 text-sm shadow-sm backdrop-blur-sm focus:border-blue-500 focus:ring-blue-500"
		>
			<option value="">-- Choose --</option>
			{#each datasetNames as datasetName (datasetName)}
				<option value={datasetName}>{datasetName}</option>
			{/each}
		</select>
	</div>

	{#if selectedConfig?.description}
		<div
			class="mt-1 rounded-lg border border-blue-100 bg-blue-50/70 p-3 text-sm text-gray-700 shadow-inner"
		>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html selectedConfig.description}
		</div>
	{/if}

	{#if selectedConfig?.loadable}
		<div
			class="flex items-center justify-between rounded-lg border border-blue-100/50 bg-blue-50/50 p-2"
		>
			<span class="text-xs font-medium text-blue-600">Pre-computed Data</span>
			<button
				onclick={handleLoad}
				disabled={isLoading}
				class="rounded bg-blue-600 px-3 py-1.5 text-xs font-bold tracking-wider text-white uppercase shadow transition-all hover:bg-blue-700 active:scale-95 disabled:bg-gray-400"
			>
				{isLoading ? 'Loading...' : 'Load Default'}
			</button>
		</div>
	{/if}

	{#if selectedDataset !== 'Gaussian-Blobs' && Object.keys(currentParams).length > 0}
		<div class="rounded-lg border border-gray-200/60 bg-gray-50/80 p-3 shadow-inner">
			<div class="mb-2 flex items-center justify-between">
				<h4 class="text-xs font-bold text-gray-500 uppercase">Generation Params</h4>
			</div>

			<div class="grid grid-cols-2 gap-x-3 gap-y-2">
				{#each Object.keys(currentParams) as key (key)}
					<div class="flex flex-col">
						<span class="mb-0.5 font-mono text-[10px] text-gray-400">{key}</span>
						<input
							type="number"
							bind:value={currentParams[key]}
							class="w-full rounded border-gray-300 px-2 py-1 text-right font-mono text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
						/>
					</div>
				{/each}
			</div>

			<button
				onclick={handleGenerate}
				disabled={isGenerating}
				class="mt-3 w-full rounded border border-gray-300 bg-white py-1.5 text-xs font-bold text-gray-700 uppercase shadow-sm transition-colors hover:bg-gray-50 hover:text-blue-600"
			>
				{isGenerating ? 'Generating...' : 'Generate New'}
			</button>
		</div>
	{/if}

	{#if selectedDataset === 'Gaussian-Blobs'}
		<div
			class="overflow-hidden rounded-lg border border-gray-200/60 bg-gray-50/80 p-2 shadow-inner"
		>
			<div class="mb-2 flex items-center justify-between px-1">
				<h4 class="text-xs font-bold text-gray-500 uppercase">Config Blobs</h4>
				<button
					onclick={addBlob}
					class="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-200"
					>+ Add</button
				>
			</div>

			<div class="custom-scrollbar flex max-h-[300px] flex-col gap-2 overflow-y-auto pr-1">
				<div
					class="grid grid-cols-[44px_1fr_1fr_1fr_52px_20px] gap-1 text-center font-mono text-[10px] text-gray-400"
				>
					<div>N</div>
					<div>X</div>
					<div>Y</div>
					<div>Z</div>
					<div>Std</div>
					<div></div>
				</div>

				{#each blobs as blob, i (i)}
					<div class="grid grid-cols-[44px_1fr_1fr_1fr_52px_20px] items-center gap-1">
						<input
							type="number"
							bind:value={blob.num_samples}
							class="w-full rounded border-gray-300 px-0.5 py-0.5 pr-0 text-center font-mono text-[10px] focus:border-blue-500 focus:ring-0"
							title="Samples"
						/>
						<input
							type="number"
							step="0.5"
							bind:value={blob.mean[0]}
							class="w-full rounded border-gray-300 px-0.5 py-0.5 pr-0 text-center font-mono text-[10px] focus:border-blue-500 focus:ring-0"
						/>
						<input
							type="number"
							step="0.5"
							bind:value={blob.mean[1]}
							class="w-full rounded border-gray-300 px-0.5 py-0.5 pr-0 text-center font-mono text-[10px] focus:border-blue-500 focus:ring-0"
						/>
						<input
							type="number"
							step="0.5"
							bind:value={blob.mean[2]}
							class="w-full rounded border-gray-300 px-0.5 py-0.5 pr-0 text-center font-mono text-[10px] focus:border-blue-500 focus:ring-0"
						/>
						<input
							type="number"
							step="0.1"
							min="0.1"
							bind:value={blob.std}
							class="w-full rounded border-gray-300 px-0.5 py-0.5 pr-0 text-center font-mono text-[10px] focus:border-blue-500 focus:ring-0"
						/>
						<button
							onclick={() => removeBlob(i)}
							class="text-xs font-bold text-red-400 hover:text-red-600">x</button
						>
					</div>
				{/each}
			</div>

			<button
				onclick={handleGenerate}
				disabled={isGenerating}
				class="mt-3 w-full rounded bg-green-600 py-1.5 text-xs font-bold text-white uppercase shadow transition-colors hover:bg-green-700"
			>
				{isGenerating ? 'Generating...' : 'Generate Blobs'}
			</button>
		</div>
	{/if}
</div>
