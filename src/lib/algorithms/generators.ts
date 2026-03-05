import { randomNormal, randomUniform } from 'd3-random';

// 基础类型定义
export interface GeneratorSettings {
	num_samples: number;
	noise?: number;
	[key: string]: any;
}

export type DatasetResult = {
	data: number[][];   // [x, y, z][]
	labels: string[];
};

// --- 辅助函数：Box-Muller 变换生成标准正态分布 ---
// d3-random 提供了生成器，但为了更灵活的控制（如复现特定逻辑），有时原生实现更方便
const rngNormal = randomNormal(0, 1); 
const rngUniform = randomUniform(0, 1);

// 1. Uniform Sphere Sampling
export function generateUniformSphere(settings: { center: number[], farthest: number, num_points: number }): number[][] {
	const { center, farthest, num_points } = settings;
	const points: number[][] = [];

	for (let i = 0; i < num_points; i++) {
		const r = rngUniform() * farthest;
		const theta = rngUniform() * 2 * Math.PI;
		const phi = rngUniform() * Math.PI;
		
		const x = r * Math.sin(phi) * Math.cos(theta);
		const y = r * Math.sin(phi) * Math.sin(theta);
		const z = r * Math.cos(phi);
		
		points.push([center[0] + x, center[1] + y, center[2] + z]);
	}
	return points;
}

// 2. Multiple Blobs (模拟 sklearn.make_blobs)
export function generateMultipleBlobs(settings: { blobs: { num_samples: number, mean: number[], std: number }[] }): DatasetResult {
	const X: number[][] = [];
	const labels: string[] = [];
	
	settings.blobs.forEach((blob, index) => {
		const generator = randomNormal(0, blob.std);
		for (let i = 0; i < blob.num_samples; i++) {
			X.push([
				blob.mean[0] + generator(),
				blob.mean[1] + generator(),
				blob.mean[2] + generator()
			]);
			labels.push(String(index));
		}
	});

	return { data: X, labels };
}

// 3. Swiss Roll (模拟 sklearn.make_swiss_roll)
export function generateSwissRoll(settings: GeneratorSettings): DatasetResult {
	const { num_samples, noise = 0.0 } = settings;
	const tGenerator = randomUniform(1.5 * Math.PI, 4.5 * Math.PI); // sklearn 默认范围
	const yGenerator = randomUniform(0, 21);
	const noiseGen = randomNormal(0, noise);

	const data: number[][] = [];
	const labels: string[] = [];
	const ys: number[] = [];

	for (let i = 0; i < num_samples; i++) {
		const t = tGenerator();
		const y = yGenerator();
		
		const x = t * Math.cos(t) + (noise > 0 ? noiseGen() : 0);
		const z = t * Math.sin(t) + (noise > 0 ? noiseGen() : 0);
		const y_noise = y + (noise > 0 ? noiseGen() : 0);
		
		data.push([x, y_noise, z]);
		ys.push(y_noise);
		labels.push(String(t)); // 原始标签通常是 t，这里转字符串
	}

	// Center Y (对应 Python: X[:, 1] -= np.mean(X[:, 1]))
	const meanY = ys.reduce((a, b) => a + b, 0) / num_samples;
	data.forEach(p => p[1] -= meanY);

	return { data, labels };
}

// 4. Two Moons (模拟 sklearn.make_moons + 3D扩展)
export function generateTwoMoons(settings: GeneratorSettings): DatasetResult {
	const { num_samples, noise = 0.1 } = settings;
	const n_samples_out = Math.floor(num_samples / 2);
	const n_samples_in = num_samples - n_samples_out;
	
	const noiseGen = randomNormal(0, noise);
	const data: number[][] = [];
	const labels: string[] = [];

	// Outer circle
	const outer_circ_x = (t: number) => Math.cos(t);
	const outer_circ_y = (t: number) => Math.sin(t);
	
	for(let i=0; i<n_samples_out; i++) {
		const t = Math.PI * (i / n_samples_out); // linspace 0 to PI
		data.push([
			(outer_circ_x(t) + noiseGen()) * 10, 
			(outer_circ_y(t) + noiseGen()) * 10, 
			0
		]);
		labels.push("0");
	}

	// Inner circle
	for(let i=0; i<n_samples_in; i++) {
		const t = Math.PI * (i / n_samples_in);
		data.push([
			(1 - Math.cos(t) + noiseGen()) * 10, 
			(1 - Math.sin(t) - 0.5 + noiseGen()) * 10, 
			0
		]);
		labels.push("1");
	}

	// Centering
	const meanX = data.reduce((sum, p) => sum + p[0], 0) / num_samples;
	const meanY = data.reduce((sum, p) => sum + p[1], 0) / num_samples;
	data.forEach(p => {
		p[0] -= meanX;
		p[1] -= meanY;
	});

	return { data, labels };
}

// 5. Enclosed Blob
export function generateEnclosedBlob(settings: { num_inner: number, num_outer: number, radius: number }): DatasetResult {
	const { num_inner, num_outer, radius } = settings;
	const data: number[][] = [];
	const labels: string[] = [];

	// Inner Gaussian
	const innerGen = randomNormal(0, 3);
	for(let i=0; i<num_inner; i++) {
		data.push([innerGen(), innerGen(), innerGen()]);
		labels.push("0");
	}

	// Outer Shell
	for(let i=0; i<num_outer; i++) {
		const angle1 = rngUniform() * 2 * Math.PI;
		const angle2 = rngUniform() * 2 * Math.PI; // 简化处理，不用完全球坐标分布，仅做演示覆盖
		// Python 代码使用的是 column_stack 生成，这里模拟球面
		data.push([
			radius * Math.sin(angle1) * Math.cos(angle2),
			radius * Math.sin(angle1) * Math.sin(angle2),
			radius * Math.cos(angle1)
		]);
		labels.push("1");
	}

	return { data, labels };
}

// 6. Connected Blobs (重点复刻)
export function generateConnectedBlobs(settings: { bridge_samples: number, cov_bridge: number }): DatasetResult {
	const { bridge_samples, cov_bridge } = settings;
	const n_samples_per_cluster = 2000;
	const cov_scale = 5.0;
	
	// Mean vectors
	const mean1 = [-10.0, 0.0, 0.0];
	const mean2 = [10.0, 0.0, 0.0];

	const data: number[][] = [];
	const labels: string[] = [];

	// Generate Cluster 1 & 2
	const clusterGen = randomNormal(0, Math.sqrt(cov_scale)); // Cov是对角阵，所以各维度独立生成
	
	for(let i=0; i<n_samples_per_cluster; i++) {
		data.push([mean1[0] + clusterGen(), mean1[1] + clusterGen(), mean1[2] + clusterGen()]);
		labels.push("0");
	}
	for(let i=0; i<n_samples_per_cluster; i++) {
		data.push([mean2[0] + clusterGen(), mean2[1] + clusterGen(), mean2[2] + clusterGen()]);
		labels.push("1");
	}

	// Generate Bridge
	const remove_ratio = 0.10;
	const bridge_offset = 0.0;
	
	// 逻辑：计算总数，去除中间，插值
	const raw_num = Math.floor(bridge_samples / (1 - remove_ratio));
	const num_remove = raw_num - bridge_samples;
	
	const t_values: number[] = [];
	const step = (1 - 2 * bridge_offset) / (raw_num - 1);
	
	// 生成 t (linspace)
	for(let i=0; i<raw_num; i++) {
		t_values.push(bridge_offset + i * step);
	}
	
	// 移除中间段 (Remove middle)
	const l = Math.floor(num_remove * 0.5);
	const mid = Math.floor(raw_num / 2);
	// t[:mid-l] + t[mid+l:]
	const keep_t = [...t_values.slice(0, mid - l), ...t_values.slice(mid + l)];

	// 生成桥点
	const bridgeNoiseGen = randomNormal(0, Math.sqrt(cov_scale * cov_bridge));
	
	keep_t.forEach(t => {
		// Linear interpolation of means
		const mX = (1 - t) * mean1[0] + t * mean2[0];
		const mY = (1 - t) * mean1[1] + t * mean2[1];
		const mZ = (1 - t) * mean1[2] + t * mean2[2];
		
		data.push([
			mX + bridgeNoiseGen(),
			mY + bridgeNoiseGen(),
			mZ + bridgeNoiseGen()
		]);
		labels.push("2");
	});

	return { data, labels };
}

// 7. S-Curve
export function generateSCurve(settings: GeneratorSettings): DatasetResult {
	const { num_samples, noise = 0.0 } = settings;
	const tGen = randomUniform(-1.5 * Math.PI, 1.5 * Math.PI); // Sklearn 默认域
	const yGen = randomUniform(0, 2); // Sklearn 默认 height
	const noiseGen = randomNormal(0, noise);

	const data: number[][] = [];
	const labels: string[] = [];
	const ys: number[] = [];

	for (let i = 0; i < num_samples; i++) {
		const t = tGen();
		const y = yGen();
		
		const x = Math.sin(t) + (noise > 0 ? noiseGen() : 0);
		const z = Math.sign(t) * (Math.cos(t) - 1) + (noise > 0 ? noiseGen() : 0);
		const y_val = y + (noise > 0 ? noiseGen() : 0);
		
		data.push([x, y_val, z]);
		ys.push(y_val);
		labels.push(String(t));
	}
	
	// Center Y and Scale
	const meanY = ys.reduce((a, b) => a + b, 0) / num_samples;
	data.forEach(p => {
		p[1] -= meanY;
		p[0] *= 6; // Python代码里做了 X *= 6
		p[1] *= 6;
		p[2] *= 6;
	});

	return { data, labels };
}

// 8. Torus Surface
export function generateTorus(settings: { num_samples: number, ring_radius: number, tube_radius: number }): DatasetResult {
	const { num_samples, ring_radius: R, tube_radius: r } = settings;
	const data: number[][] = [];
	const labels: string[] = []; // Torus 默认 label 为 0

	for(let i=0; i<num_samples; i++) {
		const theta = rngUniform() * 2 * Math.PI;
		const phi = rngUniform() * 2 * Math.PI;
		
		data.push([
			(R + r * Math.cos(phi)) * Math.cos(theta),
			(R + r * Math.cos(phi)) * Math.sin(theta),
			r * Math.sin(phi)
		]);
		labels.push("0");
	}
	return { data, labels };
}

// 9. Uniform Strip
export function generateUniformStrip(settings: { num_samples: number, length: number, width: number }): DatasetResult {
	const { num_samples, length, width } = settings;
	const data: number[][] = [];
	const labels: string[] = [];

	for(let i=0; i<num_samples; i++) {
		const x = (rngUniform() * 2 * length) - length; // -length to length
		const y = (rngUniform() * 2 * width) - width;
		const z = (rngUniform() * 2 * width) - width;
		
		data.push([x, y, z]);
		labels.push(String(x)); // Label is X coord
	}
	return { data, labels };
}