export type DatasetResult = {
	name: string;
	type: 'continuous' | 'categorical';
	data: number[][];
	labels: (string | number)[];
	source?: 'local' | 'generated';
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

	/**
	 * Try to load the pre-computed spectral initialization for a dataset.
	 * File name convention: {datasetName}_spectral_init_nn15.json
	 * Returns null if the file does not exist or fails to load.
	 */
	async loadSpectralInit(datasetName: string): Promise<number[][] | null> {
		try {
			const response = await fetch(`/datasets/${datasetName}_spectral_init_nn15.json`);
			if (!response.ok) return null;
			const json = await response.json();
			return (json.data as number[][]) ?? null;
		} catch {
			return null;
		}
	}
}