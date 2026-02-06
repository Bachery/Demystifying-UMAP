import npyjs from 'npyjs';

export type DatasetResult = {
	data: number[][];
	labels: string[];
};

export class DatasetLoader {
	private npy = new npyjs();

	/**
	 * 加载一对 .npy 文件 (data 和 labels)
	 * @param dataPath 数据的路径 (例如 /data/Swiss-Roll_data.npy)
	 * @param labelPath 标签的路径 (例如 /data/Swiss-Roll_labels.npy)
	 */
	async load(dataPath: string, labelPath: string): Promise<DatasetResult> {
		try {
			// 加载数据
			const dataRes = await this.npy.load(dataPath);
			// 加载标签
			const labelRes = await this.npy.load(labelPath);

			// 解析 Data: npyjs 返回的是一维 Float32Array，需要重组为 Nx3 数组
			const flatData = dataRes.data;
			const shape = dataRes.shape; // [N, 3]
			const numSamples = shape[0];
			const dim = shape[1];

			const data: number[][] = [];
			for (let i = 0; i < numSamples; i++) {
				const point: number[] = [];
				for (let j = 0; j < dim; j++) {
					point.push(flatData[i * dim + j]);
				}
				data.push(point);
			}

			// 解析 Labels: 假设 Label 也是数字存储的，转为字符串
			// 如果你以前存的是字符串类型的 npy，解析可能会有问题，通常建议 Label 存为 .json
			const flatLabels = labelRes.data;
			const labels: string[] = [];
			for(let i=0; i < flatLabels.length; i++) {
				labels.push(String(flatLabels[i]));
			}

			return { data, labels };

		} catch (e) {
			console.error("Failed to load .npy files", e);
			throw e;
		}
	}
}