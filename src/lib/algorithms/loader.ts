export type DatasetResult = {
	name: string;
	type: 'continuous' | 'categorical';
	data: number[][];
	labels: (string | number)[];
	source?: 'local' | 'generated';
};

const SPECTRAL_NN = [5, 15, 30, 50, 100, 200, 300, 500];

function closestNN(n: number): number {
	return SPECTRAL_NN.reduce((best, v) => (Math.abs(v - n) < Math.abs(best - n) ? v : best));
}

export class DatasetLoader {
	/**
	 * Load a single dataset JSON file from static/datasets.
	 */
	async load(fileName: string): Promise<DatasetResult> {
		try {
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
	 * Selects the file whose nn value is closest to nNeighbors.
	 * Returns null if the file does not exist or fails to load.
	 */
	async loadSpectralInit(datasetName: string, nNeighbors = 15): Promise<number[][] | null> {
		const nn = closestNN(nNeighbors);
		try {
			const response = await fetch(`/datasets/${datasetName}_spectral_init_nn${nn}.json`);
			if (!response.ok) return null;
			const json = await response.json();
			return (json.data as number[][]) ?? null;
		} catch {
			return null;
		}
	}
}
