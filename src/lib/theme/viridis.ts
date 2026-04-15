const VIRIDIS_STOPS = [
	'#440154',
	'#482878',
	'#3e4989',
	'#31688e',
	'#26828e',
	'#1f9e89',
	'#35b779',
	'#6ece58',
	'#b5de2b',
	'#fde725'
] as const;

type Rgb = {
	r: number;
	g: number;
	b: number;
};

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}

function hexToRgb(hex: string): Rgb {
	const normalized = hex.replace('#', '');
	return {
		r: parseInt(normalized.slice(0, 2), 16),
		g: parseInt(normalized.slice(2, 4), 16),
		b: parseInt(normalized.slice(4, 6), 16)
	};
}

function rgbToHex({ r, g, b }: Rgb): string {
	return `#${[r, g, b]
		.map((channel) => Math.round(channel).toString(16).padStart(2, '0'))
		.join('')}`;
}

const parsedStops = VIRIDIS_STOPS.map(hexToRgb);

export const viridisStops = [...VIRIDIS_STOPS];
export const viridisGradient = `linear-gradient(to right, ${VIRIDIS_STOPS.join(', ')})`;

export function viridisColor(t: number): string {
	const normalized = clamp01(t);
	const scaledIndex = normalized * (parsedStops.length - 1);
	const lowerIndex = Math.min(parsedStops.length - 2, Math.floor(scaledIndex));
	const upperIndex = lowerIndex + 1;
	const localT = scaledIndex - lowerIndex;
	const start = parsedStops[lowerIndex];
	const end = parsedStops[upperIndex];

	return rgbToHex({
		r: start.r + (end.r - start.r) * localT,
		g: start.g + (end.g - start.g) * localT,
		b: start.b + (end.b - start.b) * localT
	});
}

export function sampleViridisPalette(count: number): string[] {
	if (count <= 1) return [viridisColor(0)];
	return Array.from({ length: count }, (_, index) => viridisColor(index / (count - 1)));
}
