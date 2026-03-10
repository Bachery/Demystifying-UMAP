<script lang="ts">
	import { T } from '@threlte/core';
	import { OrbitControls, Grid, interactivity } from '@threlte/extras';
	import { appState } from '$lib/stores/app.svelte';
	import * as THREE from 'three';

	let { autoRotate = false } = $props();

	// Tune the raycaster threshold so hover picks stay aligned with the visible points.
	// A fixed 1 world-unit threshold is too large for this material size and causes
	// the nearest-by-depth point to be picked instead of the point under the cursor.
	const interactivityCtx = interactivity();

	type IndexedPointerEvent = {
		index?: number;
	};

	type AttributeAttachContext = {
		parent: unknown;
		ref: THREE.BufferAttribute;
	};
	$effect(() => {
		interactivityCtx.raycaster.params.Points = {
			threshold: appState.dataSize > 10000 ? 0.15 : 0.25
		};
	});

	// ==========================================
	// 1. Position buffer.
	// ==========================================
	let positions = $derived.by(() => {
		if (!appState.dataMatrix.length) return new Float32Array(0);
		return new Float32Array(appState.dataMatrix.flat());
	});

	// ==========================================
	// 1.5 RGB cache.
	// ==========================================
	const _tc3 = new THREE.Color();
	let rgbCache3D = $derived.by(() => {
		const catInfo = appState.categoriesInfo['Label'] || {};
		const cache: Record<string, { r: number; g: number; b: number }> = {};
		for (const [label, info] of Object.entries(catInfo)) {
			_tc3.set(info.color || '#cccccc');
			cache[label] = { r: _tc3.r, g: _tc3.g, b: _tc3.b };
		}
		return cache;
	});
	const _defaultRgb3D = { r: 0.8, g: 0.8, b: 0.8 };

	// ==========================================
	// 2. Color buffer.
	// ==========================================
	let colors = $derived.by(() => {
		if (!appState.dataMatrix.length) return new Float32Array(0);

		const colorArray = new Float32Array(appState.dataSize * 3);
		const selectedIdx = appState.selectedPointIdx;
		const draggedLookup = Object.fromEntries(
			appState.draggedPointsIdx.map((idx) => [idx, true] as const)
		);
		const unstableLookup = Object.fromEntries(
			appState.unstablePointsIdx.map((idx) => [idx, true] as const)
		);
		const hasUnstable = appState.ifHighlightUnstablePoints;
		const labels = appState.labelsOfSelectedCat;

		// Fade only when something is hovered or selected.
		const hasAnySelection = selectedIdx !== null || appState.draggedPointsIdx.length > 0;
		const needsFade = hasUnstable || hasAnySelection;

		// Resolve the hovered cluster label.
		const hoveredCluster = selectedIdx !== null ? String(labels[selectedIdx] ?? '') : null;

		for (let i = 0; i < appState.dataSize; i++) {
			const label = String(labels[i] ?? '');
			const c = rgbCache3D[label] ?? _defaultRgb3D;
			let r = c.r,
				g = c.g,
				b = c.b;

			if (needsFade) {
				const isInUnstable = hasUnstable && Boolean(unstableLookup[i]);
				const isInDragged = Boolean(draggedLookup[i]);
				const isInHoveredCluster = hoveredCluster !== null && label === hoveredCluster;
				if (!isInUnstable && !isInDragged && !isInHoveredCluster) {
					r = r + (1 - r) * 0.3;
					g = g + (1 - g) * 0.3;
					b = b + (1 - b) * 0.3;
				}
			}

			colorArray[i * 3] = r;
			colorArray[i * 3 + 1] = g;
			colorArray[i * 3 + 2] = b;
		}
		return colorArray;
	});

	// ==========================================
	// 3. Point size.
	// ==========================================
	let pointSize = $derived(appState.dataSize > 10000 ? 0.3 : 0.5);

	// ==========================================
	// 4. Circle texture.
	// ==========================================
	function createCircleTexture() {
		if (typeof window === 'undefined') return null;
		const size = 32;
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext('2d');
		if (!ctx) return null;
		ctx.beginPath();
		ctx.arc(16, 16, 15, 0, Math.PI * 2);
		ctx.fillStyle = 'white';
		ctx.fill();
		return new THREE.CanvasTexture(canvas);
	}
	const circleTexture = createCircleTexture();

	// ==========================================
	// 5. Hover proxy point.
	// ==========================================
	let proxyData = $derived.by(() => {
		if (appState.selectedPointIdx === null) return null;
		const idx = appState.selectedPointIdx;
		const p = appState.dataMatrix[idx];
		if (!p || p.length < 3) return null;

		const label = String(appState.labelsOfSelectedCat[idx] ?? '');
		const info = appState.categoriesInfo['Label']?.[label];
		const color = new THREE.Color(info?.color ?? '#cccccc');

		return {
			position: new Float32Array([p[0], p[1], p[2]]),
			color: new Float32Array([color.r, color.g, color.b]),
			ringColor: new Float32Array([0.2, 0.2, 0.2])
		};
	});

	// ==========================================
	// 6. Event handlers.
	// ==========================================
	function handlePointerMove(e: IndexedPointerEvent) {
		if (e.index !== undefined) {
			appState.selectedPointIdx = e.index;
			document.body.style.cursor = 'pointer';
		}
	}

	function handlePointerLeave() {
		appState.selectedPointIdx = null;
		document.body.style.cursor = 'default';
	}

	function handleClick(e: IndexedPointerEvent) {
		if (e.index !== undefined) {
			appState.toggleClusterSelection(e.index);
		}
	}

	function handleMissed() {
		appState.draggedPointsIdx = [];
	}

	function attachAttribute(name: 'position' | 'color') {
		return ({ parent, ref }: AttributeAttachContext) => {
			(parent as THREE.BufferGeometry).setAttribute(name, ref);
			return () => {};
		};
	}
</script>

<T.PerspectiveCamera
	makeDefault
	position={[20, 12, 20]}
	fov={75}
	on:create={({ ref }) => ref.lookAt(0, 0, 0)}
>
	<OrbitControls enableDamping {autoRotate} autoRotateSpeed={2.0} />
</T.PerspectiveCamera>

<T.AmbientLight intensity={0.5} />
<T.DirectionalLight position={[10, 10, 10]} intensity={1} />

<T.AxesHelper args={[50]} />
<Grid infiniteGrid fadeDistance={50} sectionColor="#eeeeee" cellColor="#dddddd" />

<!-- Main point cloud -->
{#if positions.length > 0}
	<T.Points
		onpointermove={handlePointerMove}
		onpointerleave={handlePointerLeave}
		onclick={handleClick}
		onpointermissed={handleMissed}
	>
		<T.BufferGeometry>
			<T.BufferAttribute args={[positions, 3]} attach={attachAttribute('position')} />
			<T.BufferAttribute args={[colors, 3]} attach={attachAttribute('color')} />
		</T.BufferGeometry>
		<T.PointsMaterial
			size={pointSize}
			vertexColors
			sizeAttenuation={true}
			transparent={true}
			opacity={0.9}
			map={circleTexture}
			alphaTest={0.1}
		/>
	</T.Points>
{/if}

<!-- Hover ring -->
{#if proxyData !== null}
	<T.Points renderOrder={998}>
		<T.BufferGeometry>
			<T.BufferAttribute args={[proxyData.position, 3]} attach={attachAttribute('position')} />
			<T.BufferAttribute args={[proxyData.ringColor, 3]} attach={attachAttribute('color')} />
		</T.BufferGeometry>
		<T.PointsMaterial
			size={pointSize * 3.5}
			vertexColors
			sizeAttenuation={true}
			transparent={true}
			opacity={1.0}
			map={circleTexture}
			alphaTest={0.1}
			depthTest={false}
		/>
	</T.Points>

	<!-- Hover fill -->
	<T.Points
		renderOrder={999}
		onclick={() => appState.toggleClusterSelection(appState.selectedPointIdx!)}
		onpointermissed={handleMissed}
	>
		<T.BufferGeometry>
			<T.BufferAttribute args={[proxyData.position, 3]} attach={attachAttribute('position')} />
			<T.BufferAttribute args={[proxyData.color, 3]} attach={attachAttribute('color')} />
		</T.BufferGeometry>
		<T.PointsMaterial
			size={pointSize * 3}
			vertexColors
			sizeAttenuation={true}
			transparent={true}
			opacity={1.0}
			map={circleTexture}
			alphaTest={0.1}
			depthTest={false}
		/>
	</T.Points>
{/if}
