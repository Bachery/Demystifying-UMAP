<script lang="ts">
	import { T } from '@threlte/core';
	import { OrbitControls, Grid, interactivity } from '@threlte/extras';
	import { appState } from '$lib/stores/app.svelte';
	import * as THREE from 'three';

	let { autoRotate = false } = $props();

	// Enable Threlte raycasting / pointer-event system for this Canvas
	interactivity();

	// ==========================================
	// 1. Positions — raw 3D coords, flat array
	// ==========================================
	let positions = $derived.by(() => {
		if (!appState.dataMatrix.length) return new Float32Array(0);
		return new Float32Array(appState.dataMatrix.flat());
	});

	// ==========================================
	// 2. Colors — unified fading logic
	// ==========================================
	let colors = $derived.by(() => {
		if (!appState.dataMatrix.length) return new Float32Array(0);

		const colorArray = new Float32Array(appState.dataSize * 3);
		const tempColor = new THREE.Color();
		const whiteColor = new THREE.Color('#ffffff');

		const selectedIdx = appState.selectedPointIdx;
		const draggedSet = new Set(appState.draggedPointsIdx);
		const catInfo = appState.categoriesInfo['Label'] || {};
		const unstableSet = new Set(appState.unstablePointsIdx);
		const hasUnstable = appState.ifHighlightUnstablePoints;

		// Fading is active only when something is hovered OR something is selected
		const hasAnySelection = selectedIdx !== null || draggedSet.size > 0;

		// Which cluster is currently being hovered?
		const hoveredCluster =
			selectedIdx !== null ? String(appState.labelsOfSelectedCat[selectedIdx] ?? '') : null;

		for (let i = 0; i < appState.dataSize; i++) {
			const label = String(appState.labelsOfSelectedCat[i] ?? '');

			// Base cluster color
			let colorStr = '#cccccc';
			if (hasUnstable && unstableSet.has(i)) {
				colorStr = '#ff0000';
			} else {
				const info = catInfo[label];
				if (info) colorStr = info.color;
			}
			tempColor.set(colorStr);

			// Fading: dim points that are neither dragged nor in the hovered cluster
			if (hasAnySelection) {
				const isInDragged = draggedSet.has(i);
				const isInHoveredCluster = hoveredCluster !== null && label === hoveredCluster;
				if (!isInDragged && !isInHoveredCluster) {
					tempColor.lerp(whiteColor, 0.8);
				}
			}

			colorArray[i * 3]     = tempColor.r;
			colorArray[i * 3 + 1] = tempColor.g;
			colorArray[i * 3 + 2] = tempColor.b;
		}
		return colorArray;
	});

	// ==========================================
	// 3. Point size
	// ==========================================
	let pointSize = $derived(appState.dataSize > 10000 ? 0.3 : 0.5);

	// ==========================================
	// 4. Circle texture
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
	// 5. Proxy point — hovered point, always on top at 3x size
	// ==========================================
	let proxyData = $derived.by(() => {
		if (appState.selectedPointIdx === null) return null;
		const idx = appState.selectedPointIdx;
		const p = appState.dataMatrix[idx];
		if (!p || p.length < 3) return null;

		const label = String(appState.labelsOfSelectedCat[idx] ?? '');
		const info = appState.categoriesInfo['Label']?.[label];
		const color = new THREE.Color(info?.color ?? '#cccccc');
		// Slightly brighter so it pops above faded neighbors
		color.lerp(new THREE.Color('#ffffff'), 0.3);

		return {
			position: new Float32Array([p[0], p[1], p[2]]),
			color: new Float32Array([color.r, color.g, color.b])
		};
	});

	// ==========================================
	// 6. Event handlers
	// ==========================================
	function handlePointerMove(e: any) {
		if (e.index !== undefined) {
			appState.selectedPointIdx = e.index;
			document.body.style.cursor = 'pointer';
		}
	}

	function handlePointerLeave() {
		appState.selectedPointIdx = null;
		document.body.style.cursor = 'default';
	}

	function handleClick(e: any) {
		if (e.index !== undefined) {
			appState.toggleClusterSelection(e.index);
		}
	}

	function handleMissed() {
		appState.draggedPointsIdx = [];
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
			<T.BufferAttribute
				args={[positions, 3]}
				attach={({ parent, ref }) => {
					(parent as any).setAttribute('position', ref);
					return () => {};
				}}
			/>
			<T.BufferAttribute
				args={[colors, 3]}
				attach={({ parent, ref }) => {
					(parent as any).setAttribute('color', ref);
					return () => {};
				}}
			/>
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

<!-- Proxy point — always drawn on top, 3x size, cluster color -->
{#if proxyData !== null}
	<T.Points
		renderOrder={999}
		onclick={() => appState.toggleClusterSelection(appState.selectedPointIdx!)}
		onpointermissed={handleMissed}
	>
		<T.BufferGeometry>
			<T.BufferAttribute
				args={[proxyData.position, 3]}
				attach={({ parent, ref }) => {
					(parent as any).setAttribute('position', ref);
					return () => {};
				}}
			/>
			<T.BufferAttribute
				args={[proxyData.color, 3]}
				attach={({ parent, ref }) => {
					(parent as any).setAttribute('color', ref);
					return () => {};
				}}
			/>
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
