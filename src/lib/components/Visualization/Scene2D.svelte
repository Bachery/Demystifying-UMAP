<script lang="ts">
	import { T, useThrelte } from '@threlte/core';
	import { OrbitControls, interactivity } from '@threlte/extras';
	import { appState } from '$lib/stores/app.svelte';
	import * as THREE from 'three';
	import { onDestroy } from 'svelte';

	const { size, invalidate } = useThrelte();

	// Store the interactivity context so the raycaster threshold can be tuned.
	// With sizeAttenuation=false, a fixed 1 world-unit threshold is too large. As
	// the user zooms in, the visible point radius stays at 6 px while the world-space
	// radius shrinks, which makes hover picks land noticeably off-center. The threshold
	// is recomputed from zoom so it stays close to a 4 px world-space radius.
	const interactivityCtx = interactivity();

	type IndexedPointerEvent = {
		index?: number;
	};

	type AttributeAttachContext = {
		parent: unknown;
		ref: THREE.BufferAttribute;
	};

	type SceneAPI = {
		fastMoveDraggedPoints: (
			renderIndices: number[],
			screenDx: number,
			screenDy: number
		) => { dataDx: number; dataDy: number };
		setOrbitEnabled: (enabled: boolean) => void;
		setHoverEnabled: (enabled: boolean) => void;
		getPointsInScreenRect: (rect: {
			left: number;
			top: number;
			width: number;
			height: number;
		}) => number[];
	};

	let {
		showGrid = true,
		onReady = undefined
	}: {
		showGrid?: boolean;
		onReady?: (api: SceneAPI) => void;
	} = $props();

	// Orthographic camera reference, updated on resize.
	let cameraRef = $state<THREE.OrthographicCamera | undefined>(undefined);
	// Main geometry reference, mutated in place to avoid rebuilding buffers on each UMAP frame.
	let geometryRef = $state<THREE.BufferGeometry | undefined>(undefined);

	// Cached data-to-world scale derived from positions.
	// Used by fastMoveDraggedPoints to convert screen pixels to world units.
	let _worldScale = 1;

	// Disable OrbitControls while dragging points so the camera does not pan at the same time.
	let orbitEnabled = $state(true);

	// Reactive zoom, updated from OrbitControls change events.
	// THREE.js mutates cameraRef.zoom in place, so Svelte cannot track it directly.
	let cameraZoom = $state(1);

	const HALF_WORLD = 110;

	$effect(() => {
		if (!cameraRef) return;
		const aspect = $size.width / $size.height;
		const halfH = HALF_WORLD / Math.min(1, aspect);
		cameraRef.top = halfH;
		cameraRef.bottom = -halfH;
		cameraRef.left = -halfH * aspect;
		cameraRef.right = halfH * aspect;
		cameraRef.updateProjectionMatrix();
	});

	// Keep the raycaster threshold in sync with zoom and device pixel ratio.
	// Points use sizeAttenuation=false, so their visual radius stays fixed in device
	// pixels while the world-space radius shrinks as zoom increases.
	$effect(() => {
		const zoom = cameraZoom;
		const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio ?? 1) : 1;
		const aspect = $size.width / $size.height;
		const halfH = HALF_WORLD / Math.min(1, aspect);
		// World units per device pixel.
		const worldPerDevPx = (2 * halfH) / ($size.height * dpr * zoom);
		// Use a 3 px radius plus a small tolerance.
		interactivityCtx.raycaster.params.Points = { threshold: worldPerDevPx * 3.5 };
	});

	// ==========================================
	// 1. Position buffer.
	// ==========================================
	let positions = $derived.by(() => {
		const points = appState.pointsToRender;
		if (!points || points.length === 0) return new Float32Array(0);

		const arr = new Float32Array(points.length * 3);

		let minX = Infinity,
			maxX = -Infinity;
		let minY = Infinity,
			maxY = -Infinity;
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

		// Cache the scale for fast drag updates.
		_worldScale = scale;

		for (let i = 0; i < points.length; i++) {
			arr[i * 3] = (points[i].x - centerX) * scale;
			arr[i * 3 + 1] = (points[i].y - centerY) * scale;
			arr[i * 3 + 2] = 0;
		}
		return arr;
	});

	// ==========================================
	// 2. Index map.
	// ==========================================
	let pointIndexMap = $derived.by(() => {
		const indexMap: Record<number, number> = {};
		appState.pointsToRender.forEach((p, i) => {
			indexMap[p.idx] = i;
		});
		return indexMap;
	});

	// ==========================================
	// 2.5 RGB cache.
	// ==========================================
	const _tcache = new THREE.Color();
	let rgbCache = $derived.by(() => {
		const catInfo = appState.categoriesInfo['Label'] || {};
		const cache: Record<string, { r: number; g: number; b: number }> = {};
		for (const [label, info] of Object.entries(catInfo)) {
			_tcache.set(info.color || '#cccccc');
			cache[label] = { r: _tcache.r, g: _tcache.g, b: _tcache.b };
		}
		return cache;
	});
	const _defaultRgb = { r: 0.8, g: 0.8, b: 0.8 };

	// ==========================================
	// 3. Color buffer.
	// ==========================================
	let colors = $derived.by(() => {
		const points = appState.pointsToRender;
		const sz = points?.length || 0;
		if (!sz) return new Float32Array(0);

		const selectedIdx = appState.selectedPointIdx;
		const draggedList = appState.draggedPointsIdx;
		const hasUnstable = appState.ifHighlightUnstablePoints;
		const unstableList = appState.unstablePointsIdx;

		const arr = new Float32Array(sz * 3);
		const draggedLookup = Object.fromEntries(draggedList.map((idx) => [idx, true] as const));
		const unstableLookup = Object.fromEntries(unstableList.map((idx) => [idx, true] as const));
		const defaultRgb = _defaultRgb;

		// Fade only when something is hovered or selected.
		const hasAnySelection = selectedIdx !== null || draggedList.length > 0;
		const needsFade = hasUnstable || hasAnySelection;

		// Resolve the hovered cluster label.
		const hoveredCluster =
			selectedIdx !== null ? String(appState.labelsOfSelectedCat[selectedIdx] ?? '') : null;

		for (let i = 0; i < sz; i++) {
			const p = points[i];
			const label = String(p.cluster);
			const c = rgbCache[label] ?? defaultRgb;

			let r = c.r,
				g = c.g,
				b = c.b;

			if (needsFade) {
				const isInUnstable = hasUnstable && Boolean(unstableLookup[p.idx]);
				const isInDragged = Boolean(draggedLookup[p.idx]);
				const isInHoveredCluster = hoveredCluster !== null && label === hoveredCluster;
				if (!isInUnstable && !isInDragged && !isInHoveredCluster) {
					// Fade 30% toward white.
					r = r + (1 - r) * 0.3;
					g = g + (1 - g) * 0.3;
					b = b + (1 - b) * 0.3;
				}
			}

			arr[i * 3] = r;
			arr[i * 3 + 1] = g;
			arr[i * 3 + 2] = b;
		}
		return arr;
	});

	// ==========================================
	// 4a. Sync the position buffer.
	// ==========================================
	$effect(() => {
		const pts = positions;
		const geo = geometryRef;

		if (!geo || pts.length === 0) return;

		const posAttr = geo.getAttribute('position') as THREE.BufferAttribute | null;
		const pointCount = pts.length / 3;
		if (!posAttr || posAttr.count !== pointCount) {
			// Rebuild the attribute when the point count changes.
			geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
			geo.computeBoundingSphere();
		} else {
			// Otherwise update the buffer in place and skip the bounding sphere recompute.
			posAttr.set(pts);
			posAttr.needsUpdate = true;
		}

		invalidate();
	});

	// ==========================================
	// 4b. Sync the color buffer.
	// ==========================================
	$effect(() => {
		const clrs = colors;
		const geo = geometryRef;

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
	// 5. Circle texture.
	// ==========================================
	function createCircleTexture() {
		if (typeof window === 'undefined') return null;
		const sz = 32;
		const canvas = document.createElement('canvas');
		canvas.width = sz;
		canvas.height = sz;
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
	// 6. Hover proxy point.
	// ==========================================
	let proxyData2D = $derived.by(() => {
		if (appState.selectedPointIdx === null) return null;
		const renderIdx = pointIndexMap[appState.selectedPointIdx];
		if (renderIdx === undefined) return null;

		const x = positions[renderIdx * 3];
		const y = positions[renderIdx * 3 + 1];

		const label = String(appState.labelsOfSelectedCat[appState.selectedPointIdx] ?? '');
		const c = rgbCache[label] ?? _defaultRgb;

		return {
			position: new Float32Array([x, y, 0.5]),
			// Draw a ring behind the cluster-colored fill with two stacked proxy meshes.
			fillColor: new Float32Array([c.r, c.g, c.b]),
			ringColor: new Float32Array([0.2, 0.2, 0.2])
		};
	});

	// ==========================================
	// 7. Fast drag path.
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

		// Convert screen pixels to world units from the orthographic frustum and zoom.
		const zoom = cameraRef?.zoom ?? 1;
		const aspect = $size.width / $size.height;
		const halfH = HALF_WORLD / Math.min(1, aspect);
		const worldPerPx = (2 * halfH) / ($size.height * zoom);

		const worldDx = screenDx * worldPerPx;
		const worldDy = -screenDy * worldPerPx; // Flip Y to match screen space.

		const arr = posAttr.array as Float32Array;
		for (const ri of renderIndices) {
			arr[ri * 3] += worldDx;
			arr[ri * 3 + 1] += worldDy;
		}
		posAttr.needsUpdate = true;
		autoExpandForDraggedPoints(renderIndices, arr);
		invalidate();

		// Return the data-space delta so View2D can commit it on drag end.
		const dataDx = worldDx / _worldScale;
		const dataDy = worldDy / _worldScale;
		return { dataDx, dataDy };
	}

	// Zoom out smoothly when dragged points approach the edge of the visible bounds.
	function autoExpandForDraggedPoints(renderIndices: number[], arr: Float32Array): void {
		if (!cameraRef) return;
		const cam = cameraRef;

		// Camera center in world space.
		const camX = cam.position.x;
		const camY = cam.position.y;

		// Current visible half-extents in world units.
		const halfW_vis = Math.abs(cam.left) / cam.zoom;
		const halfH_vis = cam.top / cam.zoom;

		// Keep dragged points within 85% of the visible area.
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
			// Lerp 30% toward the target zoom on each mouse move for smooth expansion.
			cam.zoom = Math.max(MIN_ZOOM, cam.zoom + (targetZoom - cam.zoom) * 0.3);
			cam.updateProjectionMatrix();
		}
	}

	function setOrbitEnabled(enabled: boolean): void {
		orbitEnabled = enabled;
	}

	let hoverEnabled = true;
	function setHoverEnabled(enabled: boolean): void {
		hoverEnabled = enabled;
		if (!enabled) {
			// Cancel any pending hover update and clear the selection immediately.
			if (_hoverRafHandle !== null) {
				cancelAnimationFrame(_hoverRafHandle);
				_hoverRafHandle = null;
			}
			_pendingHoverIdx = null;
			appState.selectedPointIdx = null;
			document.body.style.cursor = 'default';
		}
	}

	// ==========================================
	// 8. Screen rectangle hit test.
	// ==========================================
	function getPointsInScreenRect(rect: {
		left: number;
		top: number;
		width: number;
		height: number;
	}): number[] {
		if (!cameraRef || !geometryRef) return [];
		const cam = cameraRef;
		const W = $size.width;
		const H = $size.height;

		// Convert orthographic screen coordinates to world coordinates.
		function screenToWorld(sx: number, sy: number): { wx: number; wy: number } {
			const wx = (cam.left + (sx / W) * (cam.right - cam.left)) / cam.zoom + cam.position.x;
			const wy = (cam.top - (sy / H) * (cam.top - cam.bottom)) / cam.zoom + cam.position.y;
			return { wx, wy };
		}

		const { wx: wx1, wy: wy1 } = screenToWorld(rect.left, rect.top);
		const { wx: wx2, wy: wy2 } = screenToWorld(rect.left + rect.width, rect.top + rect.height);
		const minX = Math.min(wx1, wx2),
			maxX = Math.max(wx1, wx2);
		const minY = Math.min(wy1, wy2),
			maxY = Math.max(wy1, wy2);

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

	// Expose the fast drag API to View2D once the geometry is ready.
	$effect(() => {
		if (!geometryRef || !onReady) return;
		onReady({ fastMoveDraggedPoints, setOrbitEnabled, setHoverEnabled, getPointsInScreenRect });
	});

	// ==========================================
	// 9. Event handlers.
	// ==========================================
	let _pendingHoverIdx: number | null = null;
	let _hoverRafHandle: number | null = null;

	function handlePointerMove(e: IndexedPointerEvent) {
		if (!hoverEnabled || e.index === undefined) return;
		// Cache the reactive reference locally to avoid repeated proxy tracking per event.
		const pts = appState.pointsToRender;
		_pendingHoverIdx = pts[e.index].idx;
		document.body.style.cursor = 'pointer';
		if (_hoverRafHandle !== null) return; // Already scheduled.
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

	function handleClick(e: IndexedPointerEvent) {
		if (e.index !== undefined) {
			appState.toggleClusterSelection(appState.pointsToRender[e.index].idx);
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
		on:change={() => {
			if (cameraRef) cameraZoom = cameraRef.zoom;
		}}
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

<!-- Hover ring -->
{#if proxyData2D !== null}
	<T.Points renderOrder={998}>
		<T.BufferGeometry>
			<T.BufferAttribute args={[proxyData2D.position, 3]} attach={attachAttribute('position')} />
			<T.BufferAttribute args={[proxyData2D.ringColor, 3]} attach={attachAttribute('color')} />
		</T.BufferGeometry>
		<T.PointsMaterial
			size={28}
			vertexColors
			sizeAttenuation={false}
			transparent={true}
			opacity={1.0}
			map={circleTexture}
			alphaTest={0.1}
			depthTest={false}
		/>
	</T.Points>

	<!-- Hover fill. Keep it visual-only so clicks continue to hit the base point cloud. -->
	<T.Points renderOrder={999}>
		<T.BufferGeometry>
			<T.BufferAttribute args={[proxyData2D.position, 3]} attach={attachAttribute('position')} />
			<T.BufferAttribute args={[proxyData2D.fillColor, 3]} attach={attachAttribute('color')} />
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
