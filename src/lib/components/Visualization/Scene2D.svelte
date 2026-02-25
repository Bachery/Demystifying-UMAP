<script lang="ts">
	import { T, useThrelte } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import { appState } from '$lib/stores/app.svelte';
	import * as THREE from 'three';

	const { size } = useThrelte();

	// 正交相机引用，用于响应 canvas 尺寸变化时更新 frustum
	let cameraRef = $state<THREE.OrthographicCamera | undefined>(undefined);

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
		<T.BufferGeometry>
			<T.BufferAttribute
				args={[positions, 3]}
				attach={({ parent, ref }) => { (parent as any).setAttribute('position', ref); return () => {}; }}
			/>
			<T.BufferAttribute
				args={[colors, 3]}
				attach={({ parent, ref }) => { (parent as any).setAttribute('color', ref); return () => {}; }}
			/>
		</T.BufferGeometry>
		
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