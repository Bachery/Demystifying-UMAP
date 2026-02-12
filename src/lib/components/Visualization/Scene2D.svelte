<script lang="ts">
	import { T, useThrelte } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import { appState } from '$lib/stores/app.svelte';
	import * as THREE from 'three';

	// 获取 Threlte 上下文 (用于 Raycaster)
	const { camera, renderer } = useThrelte();

	// 1. 数据准备 (计算包围盒并归一化)
	let positions = $derived.by(() => {
		const points = appState.pointsToRender;
		if (!points.length) return new Float32Array(0);
		
		const arr = new Float32Array(points.length * 3);
		
		// --- [新增] 自动计算中心点和缩放 ---
		// 为了让点铺满屏幕，我们需要找到数据的 min/max
		let minX = Infinity, maxX = -Infinity;
		let minY = Infinity, maxY = -Infinity;

		for (let i = 0; i < points.length; i++) {
			const x = points[i].x;
			const y = points[i].y;
			if (x < minX) minX = x;
			if (x > maxX) maxX = x;
			if (y < minY) minY = y;
			if (y > maxY) maxY = y;
		}

		const centerX = (minX + maxX) / 2;
		const centerY = (minY + maxY) / 2;
		const rangeX = maxX - minX || 1; // 防止除以0
		const rangeY = maxY - minY || 1;
		
		// 目标是将数据映射到 [-10, 10] 的范围 (Threlte 默认视口大小附近)
		// 这样相机 zoom=20 就能刚好看到
		const targetRange = 20; 
		const scale = targetRange / Math.max(rangeX, rangeY);

		for (let i = 0; i < points.length; i++) {
			const p = points[i];
			// 居中并缩放
			arr[i * 3]     = (p.x - centerX) * scale;
			arr[i * 3 + 1] = (p.y - centerY) * scale;
			arr[i * 3 + 2] = 0;
		}
		// ----------------------------------
		
		return arr;
	});

	// 2. 颜色计算 (和 Scene3D 逻辑基本一致，除了 Cluster 来源不同)
	let colors = $derived.by(() => {
		const points = appState.pointsToRender;
		if (!points.length) return new Float32Array(0);
		
		const arr = new Float32Array(points.length * 3);
		const tempColor = new THREE.Color();
		const draggedSet = new Set(appState.draggedPointsIdx);
		const unstableSet = new Set(appState.unstablePointsIdx);

		for (let i = 0; i < points.length; i++) {
			const p = points[i];
			let colorStr = '#cccccc';

			// A. 不稳定点高亮
			if (appState.ifHighlightUnstablePoints && unstableSet.has(i)) { // 注意索引对应
				colorStr = '#ff0000';
			} 
			// B. 普通 Cluster 颜色
			else if (appState.categoriesInfo['Label']) {
				const info = appState.categoriesInfo['Label'][String(p.cluster)];
				if(info) colorStr = info.color;
			}

			// C. 交互高亮 (Hover / Drag / Select)
			const isHovered = appState.selectedPointIdx === p.idx;
			const isDragged = draggedSet.has(p.idx);
			
			if (isHovered) {
				tempColor.set('#00ff00'); // Hover 亮绿
			} else if (isDragged) {
				tempColor.set('#ffff00'); // 拖拽中 黄色
			} else {
				tempColor.set(colorStr);
				// 淡化非相关点
				if (appState.selectedPointIdx !== null || draggedSet.size > 0) {
					tempColor.lerp(new THREE.Color('#ffffff'), 0.8);
				}
			}
			
			arr[i * 3] = tempColor.r;
			arr[i * 3 + 1] = tempColor.g;
			arr[i * 3 + 2] = tempColor.b;
		}
		return arr;
	});

	// 3. 纹理 (圆点)
	function createCircleTexture() {
		if (typeof window === 'undefined') return null;
		const size = 32;
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext('2d');
		if(!ctx) return null;
		ctx.beginPath();
		ctx.arc(size/2, size/2, size/2 - 1, 0, Math.PI*2);
		ctx.fillStyle = 'white';
		ctx.fill();
		return new THREE.CanvasTexture(canvas);
	}
	const circleTexture = createCircleTexture();

	// 4. 交互逻辑 (Steering & Hover)
	let isDragging = false;
	let dragStartPos = new THREE.Vector2();
	let dragCurrentPos = new THREE.Vector2();

	function handlePointerMove(e: any) {
		// 如果正在拖拽 (Manual Mode)
		if (isDragging && appState.manualMode && appState.draggedPointsIdx.length > 0) {
			// 计算位移 delta
			// 注意：e.point 是世界坐标 (World Space)
			// 我们需要计算这一帧和上一帧的差值
			// 这里简化逻辑：我们在 pointerDown 时记录起始，move 时计算总位移
			// 但 Three.js 的事件流比较复杂，我们用简化的“相对移动”逻辑
			
			// 更稳健的做法：
			// 将当前鼠标位置投影回 World Space
			// const currentWorldPos = e.point; 
			// const dx = currentWorldPos.x - lastWorldPos.x;
			// ...
			
			// 由于 Threlte 事件封装限制，这里暂时只处理 Hover
			return;
		}

		// Hover 逻辑
		if (e.index !== undefined) {
			// 注意：pointsToRender 的索引 i 对应的真实 idx 是 points[i].idx
			const realIdx = appState.pointsToRender[e.index].idx;
			appState.selectedPointIdx = realIdx;
			document.body.style.cursor = 'pointer';
		}
	}
	
	// Steering 核心：使用 useTask (RAF) 处理拖拽
	// 因为事件回调频率可能不够，或者需要全局鼠标监听
	// 这里我们采用一种混合策略：
	// 在 Scene2D 内部监听全局 window 的 mousemove，只在 isDragging=true 时生效
	
	function onWindowMove(e: MouseEvent) {
		if (!isDragging || !appState.manualMode) return;
		
		// 将屏幕像素坐标转为 NDC (-1 to 1)
		const x = (e.clientX / window.innerWidth) * 2 - 1;
		const y = -(e.clientY / window.innerHeight) * 2 + 1;
		
		// 这一步比较难：如何把鼠标位移映射到 3D 场景位移？
		// 对于正交相机，比例是线性的。
		// zoom = camera.zoom
		// world_dx = screen_dx / zoom
		
		// TODO: 这里先留空，等下在 View2D 里通过 HTML Overlay 实现拖拽可能更简单
		// (因为 View2D 有 div 容器，可以直接监听像素位移，然后除以 scale)
	}

</script>

<T.OrthographicCamera
	makeDefault
	position={[0, 0, 50]}
	zoom={20}
	near={0.1}
	far={1000}
	on:create={({ ref }) => ref.lookAt(0, 0, 0)}
>
	<OrbitControls 
		enableRotate={false} 
		enableZoom={true} 
		mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
	/>
</T.OrthographicCamera>

<T.AxesHelper args={[50]} />
<T.GridHelper args={[100, 100, 0xeeeeee, 0xeeeeee]} rotation={[Math.PI/2, 0, 0]} />

{#if positions.length > 0}
	<T.Points 
		onpointermove={handlePointerMove}
		onpointerleave={() => {
			appState.selectedPointIdx = null;
			document.body.style.cursor = 'default';
		}}
		onpointerdown={(e: any) => {
			if (e.index !== undefined) {
				// 点击选择逻辑
				const realIdx = appState.pointsToRender[e.index].idx;
				
				// 如果按住 Shift，多选；否则单选/反选
				// 简单起见：点击即加入/移除 draggedPointsIdx
				const currentDragged = new Set(appState.draggedPointsIdx);
				if (currentDragged.has(realIdx)) {
					currentDragged.delete(realIdx);
				} else {
					currentDragged.add(realIdx);
				}
				appState.draggedPointsIdx = Array.from(currentDragged);
				
				// 标记开始拖拽
				if (appState.manualMode) {
					isDragging = true;
					// 禁止 OrbitControls
				}
			}
		}}
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
			size={1.5}
			vertexColors
			sizeAttenuation={true}
			transparent={true}
			opacity={0.9}
			map={circleTexture}
			alphaTest={0.1}
		/>
	</T.Points>
{/if}