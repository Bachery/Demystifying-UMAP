<script lang="ts">
	import { T, useThrelte } from '@threlte/core';
	import { OrbitControls, interactivity } from '@threlte/extras';
	import { appState } from '$lib/stores/app.svelte';
	import * as THREE from 'three';
	import { onDestroy } from 'svelte';

	const { size, invalidate } = useThrelte();

	type SceneAPI = {
		fastMoveDraggedPoints: (renderIndices: number[], screenDx: number, screenDy: number) => { dataDx: number; dataDy: number };
		setOrbitEnabled: (enabled: boolean) => void;
		getPointsInScreenRect: (rect: { left: number; top: number; width: number; height: number }) => number[];
	};

	let {
		showGrid = true,
		onReady = undefined
	}: {
		showGrid?: boolean;
		onReady?: (api: SceneAPI) => void;
	} = $props();

	// Enable Threlte raycasting / pointer-event system for this Canvas
	interactivity();

	// Orthographic camera ref — updated when canvas resizes
	let cameraRef = $state<THREE.OrthographicCamera | undefined>(undefined);
	// Main geometry ref — mutated in-place for perf (avoids full buffer recreate on UMAP frames)
	let geometryRef = $state<THREE.BufferGeometry | undefined>(undefined);

	// Cached data-to-world transform from the positions derived.
	// Used by fastMoveDraggedPoints to convert screen pixels → world units.
	let _worldScale   = 1;
	let _worldCenterX = 0;
	let _worldCenterY = 0;

	// Disabled while dragging points so OrbitControls doesn't pan the camera simultaneously
	let orbitEnabled = $state(true);

	const HALF_WORLD = 110;

	$effect(() => {
		if (!cameraRef) return;
		const aspect = $size.width / $size.height;
		const halfH = HALF_WORLD / Math.min(1, aspect);
		cameraRef.top    =  halfH;
		cameraRef.bottom = -halfH;
		cameraRef.left   = -halfH * aspect;
		cameraRef.right  =  halfH * aspect;
		cameraRef.updateProjectionMatrix();
	});

	// ==========================================
	// 1. Positions — scaled & centred to ±HALF_WORLD
	// ==========================================
	let positions = $derived.by(() => {
		const points = appState.pointsToRender;
		if (!points || points.length === 0) return new Float32Array(0);

		const arr = new Float32Array(points.length * 3);

		let minX = Infinity, maxX = -Infinity;
		let minY = Infinity, maxY = -Infinity;
		for (let i = 0; i < points.length; i++) {
			const p = points[i];
			if (p.x < minX) minX = p.x;
			if (p.x > maxX) maxX = p.x;
			if (p.y < minY) minY = p.y;
			if (p.y > maxY) maxY = p.y;
		}

		const centerX = (minX + maxX) / 2;
		const centerY = (minY + maxY) / 2;
		const rangeX = maxX - minX || 1;
		const rangeY = maxY - minY || 1;
		const targetRange = 200;
		const scale = targetRange / Math.max(rangeX, rangeY);

		// Cache for fast-path drag updates
		_worldScale   = scale;
		_worldCenterX = centerX;
		_worldCenterY = centerY;

		for (let i = 0; i < points.length; i++) {
			arr[i * 3]     = (points[i].x - centerX) * scale;
			arr[i * 3 + 1] = (points[i].y - centerY) * scale;
			arr[i * 3 + 2] = 0;
		}
		return arr;
	});

	// ==========================================
	// 2. Index map — fast lookup from data-idx → render-idx
	// ==========================================
	let pointIndexMap = $derived.by(() => {
		const map = new Map<number, number>();
		appState.pointsToRender.forEach((p, i) => map.set(p.idx, i));
		return map;
	});

	// ==========================================
	// 3. Colors — unified fading logic
	// ==========================================
	let colors = $derived.by(() => {
		const points = appState.pointsToRender;
		const sz = points?.length || 0;
		if (!sz) return new Float32Array(0);

		const selectedIdx  = appState.selectedPointIdx;
		const draggedList  = appState.draggedPointsIdx;
		const hasUnstable  = appState.ifHighlightUnstablePoints;
		const unstableList = appState.unstablePointsIdx;
		const catInfo      = appState.categoriesInfo['Label'] || {};

		const arr         = new Float32Array(sz * 3);
		const tempColor   = new THREE.Color();
		const whiteColor  = new THREE.Color('#ffffff');
		const draggedSet  = new Set(draggedList);
		const unstableSet = new Set(unstableList);

		// Fading is active only when something is hovered OR selected
		const hasAnySelection = selectedIdx !== null || draggedSet.size > 0;

		// Which cluster is hovered?
		const hoveredCluster =
			selectedIdx !== null
				? String(appState.labelsOfSelectedCat[selectedIdx] ?? '')
				: null;

		for (let i = 0; i < sz; i++) {
			const p     = points[i];
			const label = String(p.cluster);

			let colorStr = '#cccccc';
			if (hasUnstable && unstableSet.has(p.idx)) {
				colorStr = '#ff0000';
			} else if (catInfo[label]) {
				colorStr = catInfo[label].color;
			}
			tempColor.set(colorStr);

			// Fade points that are neither dragged nor in the hovered cluster
			if (hasAnySelection) {
				const isInDragged       = draggedSet.has(p.idx);
				const isInHoveredCluster = hoveredCluster !== null && label === hoveredCluster;
				if (!isInDragged && !isInHoveredCluster) {
					tempColor.lerp(whiteColor, 0.8);
				}
			}

			arr[i * 3]     = tempColor.r;
			arr[i * 3 + 1] = tempColor.g;
			arr[i * 3 + 2] = tempColor.b;
		}
		return arr;
	});

	// ==========================================
	// 4a. Push POSITIONS into geometry (only when positions change)
	// ==========================================
	$effect(() => {
		const pts = positions;
		const geo = geometryRef;

		if (!geo || pts.length === 0) return;

		const posAttr = geo.getAttribute('position') as THREE.BufferAttribute | null;
		if (!posAttr || posAttr.count !== pts.length / 3) {
			geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
		} else {
			posAttr.set(pts);
			posAttr.needsUpdate = true;
		}

		geo.computeBoundingSphere();
		invalidate();
	});

	// ==========================================
	// 4b. Push COLORS into geometry (only when colors change)
	// ==========================================
	$effect(() => {
		const clrs = colors;
		const geo  = geometryRef;

		if (!geo || clrs.length === 0) return;

		const colorAttr = geo.getAttribute('color') as THREE.BufferAttribute | null;
		if (!colorAttr || colorAttr.count !== clrs.length / 3) {
			geo.setAttribute('color', new THREE.BufferAttribute(clrs, 3));
		} else {
			colorAttr.set(clrs);
			colorAttr.needsUpdate = true;
		}

		invalidate();
	});

	// ==========================================
	// 5. Circle texture
	// ==========================================
	function createCircleTexture() {
		if (typeof window === 'undefined') return null;
		const sz = 32;
		const canvas = document.createElement('canvas');
		canvas.width = sz; canvas.height = sz;
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
	// 6. Proxy point — hovered point, always on top at 2x size
	// ==========================================
	let proxyData2D = $derived.by(() => {
		if (appState.selectedPointIdx === null) return null;
		const renderIdx = pointIndexMap.get(appState.selectedPointIdx);
		if (renderIdx === undefined) return null;

		const x = positions[renderIdx * 3];
		const y = positions[renderIdx * 3 + 1];

		const label = String(appState.labelsOfSelectedCat[appState.selectedPointIdx] ?? '');
		const info  = appState.categoriesInfo['Label']?.[label];
		const color = new THREE.Color(info?.color ?? '#cccccc');
		// Slightly brighter to pop above faded neighbors
		color.lerp(new THREE.Color('#ffffff'), 0.3);

		return {
			position: new Float32Array([x, y, 0.5]),
			// White ring behind + cluster color fill — two stacked proxy meshes
			fillColor:   new Float32Array([color.r, color.g, color.b]),
			ringColor:   new Float32Array([1, 1, 1])
		};
	});

	// ==========================================
	// 7. KNN graph edges — src → each targetPointsIdx
	// ==========================================
	let edgePositions = $derived.by(() => {
		if (appState.selectedPointIdx === null || appState.targetPointsIdx.length === 0) return null;

		const srcRenderIdx = pointIndexMap.get(appState.selectedPointIdx);
		if (srcRenderIdx === undefined) return null;

		const srcX = positions[srcRenderIdx * 3];
		const srcY = positions[srcRenderIdx * 3 + 1];

		const segments: number[] = [];
		for (const tgtIdx of appState.targetPointsIdx) {
			const tRenderIdx = pointIndexMap.get(tgtIdx);
			if (tRenderIdx === undefined) continue;
			// Pair: start → end
			segments.push(srcX, srcY, 0.5);
			segments.push(positions[tRenderIdx * 3], positions[tRenderIdx * 3 + 1], 0.5);
		}

		return segments.length ? new Float32Array(segments) : null;
	});

	// ==========================================
	// 8. Fast-path drag: directly patch GPU buffer, bypass reactive chain
	// ==========================================
	function fastMoveDraggedPoints(
		renderIndices: number[],
		screenDx: number,
		screenDy: number
	): { dataDx: number; dataDy: number } {
		const geo = geometryRef;
		if (!geo) return { dataDx: 0, dataDy: 0 };
		const posAttr = geo.getAttribute('position') as THREE.BufferAttribute | null;
		if (!posAttr) return { dataDx: 0, dataDy: 0 };

		// Pixel → world: derived from the orthographic camera frustum + OrbitControls zoom.
		// The camera frustum height (at zoom=1) is 2*halfH world units over $size.height pixels.
		// OrbitControls zoom further divides the visible range, so effective world-per-pixel = 2*halfH / (height*zoom).
		const zoom    = cameraRef?.zoom ?? 1;
		const aspect  = $size.width / $size.height;
		const halfH   = HALF_WORLD / Math.min(1, aspect);
		const worldPerPx = (2 * halfH) / ($size.height * zoom);

		const worldDx =  screenDx * worldPerPx;
		const worldDy = -screenDy * worldPerPx; // Y-axis flip

		const arr = posAttr.array as Float32Array;
		for (const ri of renderIndices) {
			arr[ri * 3]     += worldDx;
			arr[ri * 3 + 1] += worldDy;
		}
		posAttr.needsUpdate = true;
		autoExpandForDraggedPoints(renderIndices, arr);
		invalidate();

		// Return data-space delta so View2D can accumulate and commit on drag end
		const dataDx = worldDx / _worldScale;
		const dataDy = worldDy / _worldScale;
		return { dataDx, dataDy };
	}

	// When dragged points approach or exit the camera's visible bounds, smoothly zoom out
	// so the canvas expands to follow them.
	function autoExpandForDraggedPoints(renderIndices: number[], arr: Float32Array): void {
		if (!cameraRef) return;
		const cam = cameraRef;

		// Camera center in world space (set by OrbitControls pan)
		const camX = cam.position.x;
		const camY = cam.position.y;

		// Current visible half-extents in world units
		const halfW_vis = Math.abs(cam.left) / cam.zoom;
		const halfH_vis = cam.top / cam.zoom;

		// Target: keep dragged points within 85% of the view edge (15% breathing room)
		const SAFE_FRACTION = 0.85;

		let maxScaleNeeded = 1.0;
		for (const ri of renderIndices) {
			const wx = arr[ri * 3];
			const wy = arr[ri * 3 + 1];
			const scaleX = Math.abs(wx - camX) / (halfW_vis * SAFE_FRACTION);
			const scaleY = Math.abs(wy - camY) / (halfH_vis * SAFE_FRACTION);
			const scale = Math.max(scaleX, scaleY);
			if (scale > maxScaleNeeded) maxScaleNeeded = scale;
		}

		if (maxScaleNeeded > 1.0) {
			const targetZoom = cam.zoom / maxScaleNeeded;
			const MIN_ZOOM = 0.05;
			// Lerp 30% toward target per mouse-move event → smooth expansion
			cam.zoom = Math.max(MIN_ZOOM, cam.zoom + (targetZoom - cam.zoom) * 0.3);
			cam.updateProjectionMatrix();
		}
	}

	function setOrbitEnabled(enabled: boolean): void {
		orbitEnabled = enabled;
	}

	// ==========================================
	// 9. Screen-rect → data-index lookup (for box selection)
	// ==========================================
	function getPointsInScreenRect(rect: { left: number; top: number; width: number; height: number }): number[] {
		if (!cameraRef || !geometryRef) return [];
		const cam = cameraRef;
		const W = $size.width;
		const H = $size.height;

		// Orthographic screen → world conversion (accounts for pan + zoom)
		function screenToWorld(sx: number, sy: number): { wx: number; wy: number } {
			const wx = (cam.left + (sx / W) * (cam.right - cam.left)) / cam.zoom + cam.position.x;
			const wy = (cam.top  - (sy / H) * (cam.top - cam.bottom)) / cam.zoom + cam.position.y;
			return { wx, wy };
		}

		const { wx: wx1, wy: wy1 } = screenToWorld(rect.left, rect.top);
		const { wx: wx2, wy: wy2 } = screenToWorld(rect.left + rect.width, rect.top + rect.height);
		const minX = Math.min(wx1, wx2), maxX = Math.max(wx1, wx2);
		const minY = Math.min(wy1, wy2), maxY = Math.max(wy1, wy2);

		const posAttr = geometryRef.getAttribute('position') as THREE.BufferAttribute | null;
		if (!posAttr) return [];
		const arr = posAttr.array as Float32Array;
		const pts = appState.pointsToRender;
		const result: number[] = [];

		for (let i = 0; i < pts.length; i++) {
			const wx = arr[i * 3];
			const wy = arr[i * 3 + 1];
			if (wx >= minX && wx <= maxX && wy >= minY && wy <= maxY) {
				result.push(pts[i].idx);
			}
		}
		return result;
	}

	// Expose fast-path API to View2D once the geometry is ready
	$effect(() => {
		if (!geometryRef || !onReady) return;
		onReady({ fastMoveDraggedPoints, setOrbitEnabled, getPointsInScreenRect });
	});

	// ==========================================
	// 9. Event handlers
	// ==========================================
	let _pendingHoverIdx: number | null = null;
	let _hoverRafHandle: number | null = null;

	function handlePointerMove(e: any) {
		if (e.index === undefined) return;
		_pendingHoverIdx = appState.pointsToRender[e.index].idx;
		document.body.style.cursor = 'pointer';
		if (_hoverRafHandle !== null) return; // already scheduled
		_hoverRafHandle = requestAnimationFrame(() => {
			_hoverRafHandle = null;
			if (_pendingHoverIdx !== null) {
				appState.selectedPointIdx = _pendingHoverIdx;
				_pendingHoverIdx = null;
			}
		});
	}

	function handlePointerLeave() {
		if (_hoverRafHandle !== null) {
			cancelAnimationFrame(_hoverRafHandle);
			_hoverRafHandle = null;
		}
		_pendingHoverIdx = null;
		appState.selectedPointIdx = null;
		document.body.style.cursor = 'default';
	}

	onDestroy(() => {
		if (_hoverRafHandle !== null) cancelAnimationFrame(_hoverRafHandle);
	});

	function handleClick(e: any) {
		if (e.index !== undefined) {
			appState.toggleClusterSelection(appState.pointsToRender[e.index].idx);
		}
	}

	function handleMissed() {
		appState.draggedPointsIdx = [];
	}
</script>

<T.OrthographicCamera
	makeDefault
	position={[0, 0, 50]}
	zoom={1}
	near={0.1}
	far={1000}
	bind:ref={cameraRef}
	on:create={({ ref }) => ref.lookAt(0, 0, 0)}
>
	<OrbitControls
		enabled={orbitEnabled}
		enableRotate={false}
		enableZoom={true}
		mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
	/>
</T.OrthographicCamera>

{#if showGrid}
	<T.AxesHelper args={[50]} />
	<T.GridHelper args={[400, 40, 0xeeeeee, 0xf5f5f5]} rotation={[Math.PI / 2, 0, 0]} />
{/if}

<!-- Main point cloud -->
{#if positions.length > 0}
	<T.Points
		onpointermove={handlePointerMove}
		onpointerleave={handlePointerLeave}
		onclick={handleClick}
		onpointermissed={handleMissed}
	>
		<T.BufferGeometry bind:ref={geometryRef} />
		<T.PointsMaterial
			size={6}
			vertexColors
			sizeAttenuation={false}
			transparent={true}
			opacity={0.8}
			map={circleTexture}
			alphaTest={0.1}
		/>
	</T.Points>
{/if}

<!-- Proxy ring (white, slightly larger) -->
{#if proxyData2D !== null}
	<T.Points renderOrder={998}>
		<T.BufferGeometry>
			<T.BufferAttribute
				args={[proxyData2D.position, 3]}
				attach={({ parent, ref }) => {
					(parent as any).setAttribute('position', ref);
					return () => {};
				}}
			/>
			<T.BufferAttribute
				args={[proxyData2D.ringColor, 3]}
				attach={({ parent, ref }) => {
					(parent as any).setAttribute('color', ref);
					return () => {};
				}}
			/>
		</T.BufferGeometry>
		<T.PointsMaterial
			size={25}
			vertexColors
			sizeAttenuation={false}
			transparent={true}
			opacity={1.0}
			map={circleTexture}
			alphaTest={0.1}
			depthTest={false}
		/>
	</T.Points>

	<!-- Proxy fill (cluster color, 2x size = 8px) — drawn on top of ring -->
	<T.Points
		renderOrder={999}
		onclick={() => appState.toggleClusterSelection(appState.selectedPointIdx!)}
		onpointermissed={handleMissed}
	>
		<T.BufferGeometry>
			<T.BufferAttribute
				args={[proxyData2D.position, 3]}
				attach={({ parent, ref }) => {
					(parent as any).setAttribute('position', ref);
					return () => {};
				}}
			/>
			<T.BufferAttribute
				args={[proxyData2D.fillColor, 3]}
				attach={({ parent, ref }) => {
					(parent as any).setAttribute('color', ref);
					return () => {};
				}}
			/>
		</T.BufferGeometry>
		<T.PointsMaterial
			size={25}
			vertexColors
			sizeAttenuation={false}
			transparent={true}
			opacity={1.0}
			map={circleTexture}
			alphaTest={0.1}
			depthTest={false}
		/>
	</T.Points>
{/if}

<!-- KNN graph edges -->
{#if edgePositions !== null}
	<T.LineSegments renderOrder={997}>
		<T.BufferGeometry>
			<T.BufferAttribute
				args={[edgePositions, 3]}
				attach={({ parent, ref }) => {
					(parent as any).setAttribute('position', ref);
					return () => {};
				}}
			/>
		</T.BufferGeometry>
		<T.LineBasicMaterial color="#555555" transparent={true} opacity={0.45} depthTest={false} />
	</T.LineSegments>
{/if}
