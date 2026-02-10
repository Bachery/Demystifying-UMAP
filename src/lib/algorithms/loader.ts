export type DatasetResult = {
	name: string;
	type: 'continuous' | 'categorical';
	data: number[][];
	labels: (string | number)[];
};

export class DatasetLoader {
	/**
	 * Load single .json dataset from static/datasets/
	 * @param fileName
	 */
	async load(fileName: string): Promise<DatasetResult> {
		try {
			// files in static/datasets/
			const response = await fetch(`/datasets/${fileName}.json`);
			if (!response.ok) {
				throw new Error(`Failed to load dataset: ${response.statusText}`);
			}
			const json = await response.json();
			return json as DatasetResult;
		} catch (e) {
			console.error(`Error loading ${fileName}:`, e);
			throw e;
		}
	}
}