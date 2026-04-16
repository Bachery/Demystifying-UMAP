export function normalizePngFilename(filename: string, fallbackBase: string): string {
	const safeName = (filename.trim() || fallbackBase).replace(/[\\/]/g, '-');
	return safeName.toLowerCase().endsWith('.png') ? safeName : `${safeName}.png`;
}

export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string): void {
	const link = document.createElement('a');
	link.download = filename;
	link.href = canvas.toDataURL('image/png');
	link.click();
}

export async function waitForCanvasRedraw(): Promise<void> {
	await new Promise<void>((resolve) =>
		requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
	);
}
