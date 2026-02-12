<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { OrbitControls, Grid } from '@threlte/extras';
	import { appState } from '$lib/stores/app.svelte';
	import * as THREE from 'three';

	// 接收外部控制的 props
	let { autoRotate = false } = $props();

	// 1. 数据准备
	// 将 appState.dataset.data (3D坐标) 转换为 Three.js 需要的 BufferAttribute
	let positions = $derived.by(() => {
		if (!appState.dataMatrix.length) return new Float32Array(0);
		return new Float32Array(appState.dataMatrix.flat());
	});

	// 2. 颜色计算 (响应式)
	let colors = $derived.by(() => {
		if (!appState.dataMatrix.length) return new Float32Array(0);
		
		const colorArray = new Float32Array(appState.dataMatrix.length * 3);
		const tempColor = new THREE.Color();
		const baseColor = new THREE.Color('#cccccc'); // 默认灰色

		// 预先计算高亮集合，避免循环内重复查找
		const unstableSet = new Set(appState.unstablePointsIdx);
		const hasUnstable = appState.ifHighlightUnstablePoints;
		
		// 遍历每个点计算颜色
		for (let i = 0; i < appState.dataSize; i++) {
			// A. 基础颜色 (Cluster Color)
			let colorStr = '#cccccc';
			
			if (hasUnstable && unstableSet.has(i)) {
				colorStr = '#ff0000'; // 不稳定点红色
			} else {
				// 根据 label 获取颜色
				const label = appState.labelsOfSelectedCat[i];
				if (label && appState.categoriesInfo['Label']) {
					// 从 categoriesInfo 中取颜色
					const info = appState.categoriesInfo['Label'][String(label)];
					if(info) colorStr = info.color;
				}
			}

			// B. 高亮逻辑 (Selection / Hover)
			// 逻辑：如果当前有点被选中/Hover，非相关的点变淡
			const isHovered = appState.selectedPointIdx === i;
			// 简单的逻辑：选中变绿，否则用 Cluster 颜色
			if (isHovered) {
				tempColor.set('#00ff00');
			} else {
				tempColor.set(colorStr);
				// 如果有选中点，其他点变淡 (Opacity 逻辑在 Fragment Shader 或 alphaTest 处理更佳，这里简单处理)
				if (appState.selectedPointIdx !== null) {
					tempColor.lerp(new THREE.Color('#ffffff'), 0.8);
				}
			}
			
			colorArray[i * 3] = tempColor.r;
			colorArray[i * 3 + 1] = tempColor.g;
			colorArray[i * 3 + 2] = tempColor.b;
		}
		
		return colorArray;
	});

	// 3. 点大小
	// 如果点数 > 10000，稍微小一点
	let pointSize = $derived(appState.dataSize > 10000 ? 0.3 : 0.5);

	// 4. 圆点纹理
	function createCircleTexture() {
		// 在 SSR 环境下不执行
		if (typeof window === 'undefined') return null;
		
		const size = 32;
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		const context = canvas.getContext('2d');
		if (!context) return null;
		
		context.beginPath();
		context.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
		context.fillStyle = 'white';
		context.fill();
		return new THREE.CanvasTexture(canvas);
	}
	// 创建纹理实例 (只需创建一次)
	const circleTexture = createCircleTexture();

	// 5. 交互事件处理
	function handlePointerMove(e: any) {
		// e.index 是 Threlte 提供的，直接告诉你是哪个点
		if (e.index !== undefined) {
			appState.selectedPointIdx = e.index;
			document.body.style.cursor = 'pointer';
		}
	}

	function handlePointerLeave() {
		appState.selectedPointIdx = null;
		document.body.style.cursor = 'default';
	}

</script>

<T.PerspectiveCamera
	makeDefault
	position={[20, 12, 20]}
	fov={75}
	on:create={({ ref }) => ref.lookAt(0, 0, 0)}
>
	<OrbitControls 
		enableDamping 
		autoRotate={autoRotate}
		autoRotateSpeed={2.0}
	/>
</T.PerspectiveCamera>

<T.AmbientLight intensity={0.5} />
<T.DirectionalLight position={[10, 10, 10]} intensity={1} />

<T.AxesHelper args={[50]} />
<Grid 
	infiniteGrid 
	fadeDistance={50} 
	sectionColor="#eeeeee" 
	cellColor="#dddddd"
/>

{#if positions.length > 0}
	<T.Points 
		onpointermove={handlePointerMove}
		onpointerleave={handlePointerLeave}
	>
		<T.BufferGeometry>
			<T.BufferAttribute
				args={[positions, 3]}
				attach={({ parent, ref }) => {
					// parent 是 BufferGeometry, ref 是 BufferAttribute
					// 使用 'as any' 规避严格类型检查，确保 TS 知道它有 setAttribute 方法
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

{#if appState.selectedPointIdx !== null && appState.dataMatrix[appState.selectedPointIdx]}
	{@const p = appState.dataMatrix[appState.selectedPointIdx]}
	<T.Mesh position={[p[0], p[1], p[2]]}>
		<T.SphereGeometry args={[pointSize * 1.5]} />
		<T.MeshBasicMaterial color="#00ff00" depthTest={false} transparent opacity={0.8} />
	</T.Mesh>
{/if}