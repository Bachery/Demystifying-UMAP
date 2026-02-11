<script lang="ts">
	import { appState } from '$lib/stores/app.svelte';
	import { DatasetLoader } from '$lib/algorithms/loader';
	// 假设你把 generators 导出了
	import * as Generators from '$lib/algorithms/generators'; 

	let selectedDataset = $state('');
	let isGenerating = $state(false);

	// 把论文的描述整理成一个干净的配置对象
	const datasetDescriptions: Record<string, string> = {
		'Antipodal-Clusters':	'<b>Case 1 (Initialization Sensitivity):</b> Symmetric clusters arranged around a center. Default UMAP often loses global symmetry, placing opposite pairs on the same side. Use <i>Manual Mode</i> to restore the correct antipodal alignment.',
		'Enclosed-Blob':		'<b>Case 3 (Multi-scale Topology):</b> A dense core surrounded by a spherical shell. Low <code>n_neighbors</code> treats them as disjoint clusters, while high values reveal the global nesting (enclosure) relationship.',
		'Two-Moons':			'<b>Case 2 (Topological Tearing):</b> Two interleaved continuous manifolds. Due to spatial proximity, UMAP may incorrectly fragment (tear) the crescents or merge them. Check for continuity against the 3D ground truth.',
		'Swiss-Roll':			'<b>Unfolding Test:</b> A classic curled manifold. UMAP aims to "unroll" this into a flat strip. Watch for topological tears (holes in the strip) or incomplete unfolding.',
		'Uniform-Strip':		'<b>Continuity Test:</b> A simple, long continuous strip. A baseline for testing fragmentation. If <code>n_neighbors</code> is low, the single manifold may break into multiple artificial islands.',
		'Torus-Surface':		'<b>Case 4 (Genus Preservation):</b> A closed surface with a central hole (genus-1). Standard settings often collapse the hole or tear the loop. Preserving the hole requires balancing global structure against local compactness.',
		'S-Curve':				'<b>Intrinsic vs. Extrinsic:</b> An S-shaped curve. UMAP typically straightens/flattens it. This demonstrates how the algorithm preserves intrinsic neighborhood relationships while discarding extrinsic 3D curvature.',
		'Density-Contrast':		'<b>Metric Distortion:</b> Two clusters with significantly different densities. UMAP normalizes local connectivity, causing sparse and dense clusters to appear visually similar in size. Density cues are often lost.',
		'Distance-Contrast':	'<b>Global Distance Distortion:</b> Clusters with varying inter-cluster distances. UMAP is not isometric; global distances in the 2D embedding do not linearly reflect the absolute separation in 3D space.',
		'Connected-Blobs':		'<b>Case 5 (Density Fragility):</b> Dense clusters linked by a sparse bridge. A stress test for density sensitivity: surprisingly, increasing <code>n_neighbors</code> (global optimization) may cause the weak bridge to snap and be absorbed by the dense clusters.',
		'Gaussian-Blobs':		'<b>Baseline:</b> Standard Gaussian clusters. Use this to verify basic cluster separation and to test how initialization affects the relative positioning of distinct groups.',
	};

	const datasetList = [
		'Antipodal-Clusters', 'Enclosed-Blob', 'Two-Moons', 'Swiss-Roll', 
		'Uniform-Strip', 'Torus-Surface', 'S-Curve', 'Density-Contrast', 
		'Distance-Contrast', 'Connected-Blobs', 'Gaussian-Blobs',
		'Hierarchical-Blobs', 'Hierarchy-Loss',
		'WorldMap', 'WorldMapRoll', 'WorldMapGlobe',
	];

	// 加载/生成逻辑
	async function loadOrGenerate() {
		if (!selectedDataset) return;
		isGenerating = true;

		try {
			// 策略：先尝试纯前端生成，如果不属于生成类，则调用 Loader 加载 json
			let result;
			if (selectedDataset === 'Swiss-Roll') {
				result = Generators.generateSwissRoll({ num_samples: 5000, noise: 1.0 });
			} else if (selectedDataset === 'Two-Moons') {
				result = Generators.generateTwoMoons({ num_samples: 5000, noise: 0.17 });
			} else if (selectedDataset === 'Connected-Blobs') {
				result = Generators.generateConnectedBlobs({ bridge_samples: 500, cov_bridge: 0.8 });
			} else {
				// 如果是没写生成器的静态数据，从 /static/datasets/ 下加载
				const loader = new DatasetLoader();
				result = await loader.load(selectedDataset);
			}
			
			// 存入全局状态，触发视图更新
			if(result) appState.setDataset(result);
			
		} catch (e) {
			console.error(e);
			alert("Failed to load dataset.");
		} finally {
			isGenerating = false;
		}
	}
</script>

<div class="flex flex-col gap-3">
	<div class="flex gap-2">
		<select 
			bind:value={selectedDataset} 
			class="flex-1 rounded-lg border-gray-300 text-sm focus:ring-blue-500 focus:border-blue-500 shadow-sm bg-white/80"
		>
			<option value="">-- Select a dataset --</option>
			{#each datasetList as d}
				<option value={d}>{d}</option>
			{/each}
		</select>
		
		<button 
			onclick={loadOrGenerate}
			disabled={!selectedDataset || isGenerating}
			class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
		>
			{isGenerating ? 'Loading...' : 'Load'}
		</button>
	</div>

	{#if selectedDataset && datasetDescriptions[selectedDataset]}
		<div class="p-3 mt-1 text-sm text-gray-700 bg-blue-50/70 border border-blue-100 rounded-lg shadow-inner">
			{@html datasetDescriptions[selectedDataset]}
		</div>
	{/if}
</div>