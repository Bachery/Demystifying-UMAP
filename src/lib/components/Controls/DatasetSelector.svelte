<script lang="ts">
	import { appState } from '$lib/stores/app.svelte';
	import { DatasetLoader } from '$lib/algorithms/loader';
	import * as Generators from '$lib/algorithms/generators'; 

	// ==========================================
	// 1. 配置定义 (Configuration)
	// ==========================================

	const datasetList = [
		'Antipodal-Clusters', 'Enclosed-Blob', 'Two-Moons', 'Swiss-Roll', 
		'Uniform-Strip', 'Torus-Surface', 'S-Curve', 'Density-Contrast', 
		'Distance-Contrast', 'Connected-Blobs',
		'Hierarchical-Blobs', 'Hierarchy-Loss',
		'WorldMap', 'WorldMapRoll', 'WorldMapGlobe',
		'Gaussian-Blobs',
	];

	// 有静态文件的数据集 (Show Load Button)
	const loadableDatasets = new Set([
		'Antipodal-Clusters', 'Enclosed-Blob', 'Two-Moons', 'Swiss-Roll', 
		'Uniform-Strip', 'Torus-Surface', 'S-Curve', 'Density-Contrast', 
		'Distance-Contrast', 'Connected-Blobs',
		'Hierarchical-Blobs', 'Hierarchy-Loss',
		'WorldMap', 'WorldMapRoll', 'WorldMapGlobe',
	]);
	
	// 可生成的数据集及其默认参数 (Show Generate UI)
	// 格式: { [paramName]: defaultValue }
	const defaultSettings: Record<string, any> = {
		'Enclosed-Blob':   { num_inner: 5000, num_outer: 2000, radius: 10.0, seed: 42 },
		'Two-Moons':       { num_samples: 5000, noise: 0.17, seed: 42 },
		'Swiss-Roll':      { num_samples: 5000, noise: 1.0, seed: 42 },
		'Uniform-Strip':   { num_samples: 5000, length: 15.0, width: 1.0, seed: 42 },
		'Torus-Surface':   { num_samples: 5000, ring_radius: 10.0, tube_radius: 8.0, seed: 42 },
		'S-Curve':         { num_samples: 5000, noise: 0.33, seed: 42 },
		'Connected-Blobs': { bridge_samples: 500, cov_bridge: 0.8, seed: 42 },
		// Gaussian-Blobs 特殊处理，不放在这里
		'Gaussian-Blobs':  { seed: 42 } 
	};

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

	// ==========================================
	// 2. 状态管理 (State)
	// ==========================================

	let selectedDataset = $state('');
	let isLoading = $state(false);
	let isGenerating = $state(false);
	
	// 当前选中的参数 (用于通用生成器)
	let currentParams = $state<Record<string, number>>({});

	// Gaussian Blobs 的特殊状态
	let blobSeed = $state(42);
	let blobs = $state([
		{ num_samples: 2000, mean: [0, 0, 0], std: 0.8 }
	]);

	// 监听选择变化，重置参数
	function handleSelectionChange() {
		if (defaultSettings[selectedDataset]) {
			// 深拷贝默认参数
			currentParams = { ...defaultSettings[selectedDataset] };
		} else {
			currentParams = {};
		}
	}

	// Gaussian Blobs 操作
	function addBlob() {
		blobs.push({ num_samples: 2000, mean: [0, 0, 0], std: 0.8 });
	}
	function removeBlob(index: number) {
		if (blobs.length > 1) {
			blobs = blobs.filter((_, i) => i !== index);
		}
	}
	
	// ==========================================
	// 3. 核心逻辑 (Actions)
	// ==========================================

	// A. 加载静态文件
	async function handleLoad() {
		if (!selectedDataset) return;
		isLoading = true;
		try {
			const loader = new DatasetLoader();
			const result = await loader.load(selectedDataset);
			appState.setDataset(result);
		} catch (e) {
			console.error(e);
			alert(`Failed to load ${selectedDataset}`);
		} finally {
			isLoading = false;
		}
	}

	// B. 生成数据
	async function handleGenerate() {
		isGenerating = true;
		try {
			// 稍微延迟一下让 UI 响应
			await new Promise(r => setTimeout(r, 10));

			let result;
			// 使用 'as any' 绕过严格类型检查，因为不同的生成器需要的参数结构完全不同
			// (例如 SwissRoll 需要 num_samples，但 EnclosedBlob 需要 num_inner)
			const params = $state.snapshot(currentParams) as any; // 获取纯对象

			// 1. 特殊处理 Gaussian Blobs
			if (selectedDataset === 'Gaussian-Blobs') {
				result = Generators.generateMultipleBlobs({
					blobs: $state.snapshot(blobs), // 注意：generators.ts 需要适配这个结构
					// 如果 generators.ts 里的类型定义还是 {seed, ...}，这里可能需要适配
					// 目前假设 generateMultipleBlobs 接受 { blobs: [...] }
				});
			} 
			// 2. 通用处理
			else {
				// 根据名字调用对应的生成函数
				switch (selectedDataset) {
					case 'Swiss-Roll': result = Generators.generateSwissRoll(params); break;
					case 'Two-Moons': result = Generators.generateTwoMoons(params); break;
					case 'Enclosed-Blob': result = Generators.generateEnclosedBlob(params as any); break;
					case 'Connected-Blobs': result = Generators.generateConnectedBlobs(params as any); break;
					case 'S-Curve': result = Generators.generateSCurve(params); break;
					case 'Torus-Surface': result = Generators.generateTorus(params as any); break;
					case 'Uniform-Strip': result = Generators.generateUniformStrip(params as any); break;
					default: console.warn("No generator found for", selectedDataset);
				}
			}

			if (result) {
				// 自动补充 name 和 type
				const datasetResult = {
					...result,
					name: selectedDataset,
					type: (['Swiss-Roll', 'S-Curve', 'Uniform-Strip'].includes(selectedDataset)) ? 'continuous' : 'categorical'
				};
				appState.setDataset(datasetResult);
			}

		} catch (e) {
			console.error(e);
			alert("Generation failed check console.");
		} finally {
			isGenerating = false;
		}
	}
</script>

<div class="flex flex-col gap-4">
	
	<div class="relative">
		<label for="dataset-select" class="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Select Dataset</label>
		<select 
			bind:value={selectedDataset} 
			onchange={handleSelectionChange}
			class="w-full rounded-lg border-gray-300 text-sm focus:ring-blue-500 focus:border-blue-500 shadow-sm bg-white/80 backdrop-blur-sm"
		>
			<option value="">-- Choose --</option>
			{#each datasetList as d}
				<option value={d}>{d}</option>
			{/each}
		</select>
	</div>

	{#if selectedDataset && datasetDescriptions[selectedDataset]}
		<div class="p-3 mt-1 text-sm text-gray-700 bg-blue-50/70 border border-blue-100 rounded-lg shadow-inner">
			{@html datasetDescriptions[selectedDataset]}
		</div>
	{/if}

	{#if loadableDatasets.has(selectedDataset)}
		<div class="flex items-center justify-between bg-blue-50/50 p-2 rounded-lg border border-blue-100/50">
			<span class="text-xs text-blue-600 font-medium">Pre-computed Data</span>
			<button 
				onclick={handleLoad}
				disabled={isLoading}
				class="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold uppercase tracking-wider rounded shadow hover:bg-blue-700 disabled:bg-gray-400 transition-all active:scale-95"
			>
				{isLoading ? 'Loading...' : 'Load Default'}
			</button>
		</div>
	{/if}

	{#if selectedDataset !== 'Gaussian-Blobs' && defaultSettings[selectedDataset]}
		<div class="bg-gray-50/80 rounded-lg p-3 border border-gray-200/60 shadow-inner">
			<div class="flex justify-between items-center mb-2">
				<h4 class="text-xs font-bold text-gray-500 uppercase">Generation Params</h4>
			</div>
			
			<div class="grid grid-cols-2 gap-x-3 gap-y-2">
				{#each Object.keys(currentParams) as key}
					{#if key !== 'seed'}
						<div class="flex flex-col">
							<!-- <label class="text-[10px] text-gray-400 font-mono mb-0.5">{key}</label> -->
							<span class="text-[10px] text-gray-400 font-mono mb-0.5">{key}</span>
							<input 
								type="number" 
								bind:value={currentParams[key]}
								class="w-full text-xs py-1 px-2 rounded border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-right font-mono"
							/>
						</div>
					{/if}
				{/each}
				
				{#if 'seed' in currentParams}
				<div class="flex flex-col">
					<!-- <label class="text-[10px] text-gray-400 font-mono mb-0.5">seed</label> -->
					<span class="text-[10px] text-gray-400 font-mono mb-0.5">seed</span>
					<input type="number" bind:value={currentParams['seed']} class="w-full text-xs py-1 px-2 rounded border-gray-300 text-right font-mono"/>
				</div>
				{/if}
			</div>

			<button 
				onclick={handleGenerate}
				disabled={isGenerating}
				class="w-full mt-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-bold uppercase rounded shadow-sm hover:bg-gray-50 hover:text-blue-600 transition-colors"
			>
				{isGenerating ? 'Generating...' : 'Generate New'}
			</button>
		</div>
	{/if}

	{#if selectedDataset === 'Gaussian-Blobs'}
		<div class="bg-gray-50/80 rounded-lg p-2 border border-gray-200/60 shadow-inner overflow-hidden">
			<div class="flex justify-between items-center mb-2 px-1">
				<h4 class="text-xs font-bold text-gray-500 uppercase">Config Blobs</h4>
				<button onclick={addBlob} class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-200">+ Add</button>
			</div>

			<div class="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
				<div class="grid grid-cols-[30px_1fr_1fr_1fr_40px_20px] gap-1 text-[10px] text-center text-gray-400 font-mono">
					<div>N</div>
					<div>X</div>
					<div>Y</div>
					<div>Z</div>
					<div>Std</div>
					<div></div>
				</div>

				{#each blobs as blob, i}
					<div class="grid grid-cols-[30px_1fr_1fr_1fr_40px_20px] gap-1 items-center">
						<input 
							type="number" 
							bind:value={blob.num_samples} 
							class="w-full text-[10px] py-0.5 px-0.5 rounded border-gray-300 text-center font-mono focus:border-blue-500 focus:ring-0 pr-0"
							title="Samples"
						/>
						<input type="number" step="0.5" bind:value={blob.mean[0]} class="w-full text-[10px] py-0.5 px-0.5 rounded border-gray-300 text-center font-mono focus:border-blue-500 focus:ring-0 pr-0"/>
						<input type="number" step="0.5" bind:value={blob.mean[1]} class="w-full text-[10px] py-0.5 px-0.5 rounded border-gray-300 text-center font-mono focus:border-blue-500 focus:ring-0 pr-0"/>
						<input type="number" step="0.5" bind:value={blob.mean[2]} class="w-full text-[10px] py-0.5 px-0.5 rounded border-gray-300 text-center font-mono focus:border-blue-500 focus:ring-0 pr-0"/>
						<input type="number" step="0.1" min="0.1" bind:value={blob.std} class="w-full text-[10px] py-0.5 px-0.5 rounded border-gray-300 text-center font-mono focus:border-blue-500 focus:ring-0 pr-0"/>
						<button onclick={() => removeBlob(i)} class="text-red-400 hover:text-red-600 text-xs font-bold">×</button>
					</div>
				{/each}
			</div>

			<button 
				onclick={handleGenerate}
				disabled={isGenerating}
				class="w-full mt-3 py-1.5 bg-green-600 text-white text-xs font-bold uppercase rounded shadow hover:bg-green-700 transition-colors"
			>
				Generate Blobs
			</button>
		</div>
	{/if}

</div>
