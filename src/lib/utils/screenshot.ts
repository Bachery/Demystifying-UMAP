export function normalizePngFilename(filename: string, fallbackBase: string): string {
	const safeName = (filename.trim() || fallbackBase).replace(/[\\/]/g, '-');
	return safeName.toLowerCase().endsWith('.png') ? safeName : `${safeName}.png`;
}

export function normalizeWebmFilename(filename: string, fallbackBase: string): string {
	const safeName = (filename.trim() || fallbackBase).replace(/[\\/]/g, '-');
	return safeName.toLowerCase().endsWith('.webm') ? safeName : `${safeName}.webm`;
}

export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string): void {
	const link = document.createElement('a');
	link.download = filename;
	link.href = canvas.toDataURL('image/png');
	link.click();
}

export function downloadBlob(blob: Blob, filename: string): void {
	const link = document.createElement('a');
	link.download = filename;
	link.href = URL.createObjectURL(blob);
	link.click();
	URL.revokeObjectURL(link.href);
}

export function getSupportedVideoMimeType(): string {
	if (typeof MediaRecorder === 'undefined') return '';
	const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
	return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

export async function waitForCanvasRedraw(): Promise<void> {
	await new Promise<void>((resolve) =>
		requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
	);
}
