<script lang="ts">
	import { T, useThrelte } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import { appState } from '$lib/stores/app.svelte';
	import * as THREE from 'three';

	const { size, invalidate } = useThrelte();

	// 正交相机引用，用于响应 canvas 尺寸变化时更新 frustum
	let cameraRef = $state<THREE.OrthographicCamera | undefined>(undefined);
	// BufferGeometry 引用，用于手动更新属性并触发重绘
	let geometryRef = $state<THREE.BufferGeometry | undefined>(undefined);

	// 数据缩放到 ±100（targetRange=200），加 10% padding 留边距
	const HALF_WORLD = 110;

	$effect(() => {
		if (!cameraRef) return;
		const aspect = $size.width / $size.height;
		// 短边对齐数据范围 ±HALF_WORLD，长边按比例延伸留白
		// aspect >= 1（横向）：短边 = 高，halfH = HALF_WORLD
		// aspect <  1（纵向）：短边 = 宽，halfH = HALF_WORLD / aspect（使宽度 = ±HALF_WORLD）
		const halfH = HALF_WORLD / Math.min(1, aspect);
		cameraRef.top    =  halfH;
		cameraRef.bottom = -halfH;
		cameraRef.left   = -halfH * aspect;
		cameraRef.right  =  halfH * aspect;
		cameraRef.updateProjectionMatrix();
	});

	// ==========================================
	// 1. 极致性能坐标生成 (原生 Float32Array + 自动居中)
	// ==========================================
	let positions = $derived.by(() => {
		const points = appState.pointsToRender;
		console.log('[Scene2D] positions derived running, points.length:', points?.length);
		if (!points || points.length === 0) return new Float32Array(0);
		
		const arr = new Float32Array(points.length * 3);
		
		// A. 计算 Bounding Box (包围盒)
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
		
		// B. 动态缩放算法
		// 我们把数据强行展开到宽幅 200 的世界坐标中
		const targetRange = 200; 
		const scale = targetRange / Math.max(rangeX, rangeY);

		for (let i = 0; i < points.length; i++) {
			// 平移居中并放大
			arr[i * 3]     = (points[i].x - centerX) * scale;
			arr[i * 3 + 1] = (points[i].y - centerY) * scale;
			arr[i * 3 + 2] = 0;
		}
		return arr;
	});

	// ==========================================
	// 2. 颜色计算剥离优化 (防止每帧 New Object)
	// ==========================================
	let colors = $derived.by(() => {
		const size = appState.pointsToRender?.length || 0;
		if (!size) return new Float32Array(0);
		
		// 显式声明依赖，这样只有当这些变量改变时，颜色才会重新计算
		// 而不会因为 positions 坐标的改变（UMAP迭代）而导致重算！
		const selectedIdx = appState.selectedPointIdx;
		const draggedList = appState.draggedPointsIdx;
		const points = appState.pointsToRender;
		const hasUnstable = appState.ifHighlightUnstablePoints;
		const unstableList = appState.unstablePointsIdx;
		const catInfo = appState.categoriesInfo['Label'] || {};

		const arr = new Float32Array(size * 3);
		
		// 循环外实例化，极大地节约内存和 GC 开销
		const tempColor = new THREE.Color();
		const whiteColor = new THREE.Color('#ffffff');
		
		const draggedSet = new Set(draggedList);
		const unstableSet = new Set(unstableList);
		const hasAnySelection = selectedIdx !== null || draggedSet.size > 0;

		for (let i = 0; i < size; i++) {
			const p = points[i];
			
			// 基础颜色
			let colorStr = '#cccccc';
			if (hasUnstable && unstableSet.has(p.idx)) {
				colorStr = '#ff0000';
			} else if (catInfo[String(p.cluster)]) {
				colorStr = catInfo[String(p.cluster)].color;
			}

			// 交互状态
			if (selectedIdx === p.idx) {
				tempColor.set('#00ff00');
			} else if (draggedSet.has(p.idx)) {
				tempColor.set('#ffff00');
			} else {
				tempColor.set(colorStr);
				// 褪色逻辑
				if (hasAnySelection) {
					tempColor.lerp(whiteColor, 0.8);
				}
			}
			
			arr[i * 3] = tempColor.r;
			arr[i * 3 + 1] = tempColor.g;
			arr[i * 3 + 2] = tempColor.b;
		}
		return arr;
	});

	// 手动更新 BufferGeometry 属性，确保每次 positions/colors 变化时 GPU 数据都被刷新
	// 注意：先读取所有响应式变量，避免 short-circuit 导致依赖追踪不完整
	$effect(() => {
		const pts = positions;   // 先读，确保 Svelte 追踪此依赖
		const clrs = colors;     // 同上
		const geo = geometryRef; // 同上

		console.log('[Scene2D] $effect triggered — geo:', !!geo, 'pts.length:', pts.length);

		if (!geo || pts.length === 0) return;

		console.log('[Scene2D] updating geometry, pts[0,1]:', pts[0]?.toFixed(3), pts[1]?.toFixed(3));

		// 更新 position 属性
		const posAttr = geo.getAttribute('position') as THREE.BufferAttribute | null;
		if (!posAttr || posAttr.count !== pts.length / 3) {
			geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
		} else {
			posAttr.set(pts);
			posAttr.needsUpdate = true;
		}

		// 更新 color 属性
		const colorAttr = geo.getAttribute('color') as THREE.BufferAttribute | null;
		if (!colorAttr || colorAttr.count !== clrs.length / 3) {
			geo.setAttribute('color', new THREE.BufferAttribute(clrs, 3));
		} else {
			colorAttr.set(clrs);
			colorAttr.needsUpdate = true;
		}

		// 重算包围球（避免 frustum culling 剔除）
		geo.computeBoundingSphere();

		// 通知 Threlte 在下一帧重新渲染
		invalidate();
		console.log('[Scene2D] invalidate() called');
	});

	// 纹理生成
	function createCircleTexture() {
		if (typeof window === 'undefined') return null;
		const size = 32;
		const canvas = document.createElement('canvas');
		canvas.width = size; canvas.height = size;
		const ctx = canvas.getContext('2d');
		if(!ctx) return null;
		ctx.beginPath();
		ctx.arc(16, 16, 15, 0, Math.PI*2);
		ctx.fillStyle = 'white';
		ctx.fill();
		return new THREE.CanvasTexture(canvas);
	}
	const circleTexture = createCircleTexture();

	// 交互处理
	function handlePointerMove(e: any) {
		if (e.index !== undefined) {
			const realIdx = appState.pointsToRender[e.index].idx;
			appState.selectedPointIdx = realIdx;
			document.body.style.cursor = 'pointer';
		}
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
		enableRotate={false} 
		enableZoom={true} 
		mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
	/>
</T.OrthographicCamera>

<T.AxesHelper args={[50]} />
<T.GridHelper args={[400, 40, 0xeeeeee, 0xf5f5f5]} rotation={[Math.PI/2, 0, 0]} />

{#if positions.length > 0}
	<T.Points 
		onpointermove={handlePointerMove}
		onpointerleave={() => {
			appState.selectedPointIdx = null;
			document.body.style.cursor = 'default';
		}}
	>
		<T.BufferGeometry bind:ref={geometryRef} />
		
		<T.PointsMaterial
			size={4} 
			vertexColors
			sizeAttenuation={false} 
			transparent={true}
			opacity={0.8}
			map={circleTexture}
			alphaTest={0.1}
		/>
	</T.Points>
{/if}