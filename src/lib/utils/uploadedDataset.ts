import type { DatasetResult } from '$lib/algorithms/loader';

const DELIMITER_CANDIDATES = [',', '\t', ';'] as const;
const DEFAULT_LABEL = '(unlabeled)';
const UPLOADED_VIEW_HALF_EXTENT = 12;

export type ParsedDelimitedFile = {
	fileName: string;
	rows: string[][];
	delimiter: string;
	detectedHasHeader: boolean;
};

export type UploadedTable = {
	fileName: string;
	columns: string[];
	rows: string[][];
	delimiter: string;
	hasHeader: boolean;
};

export type UploadedDatasetBundle = {
	dataset: DatasetResult;
	table: UploadedTable;
	labelColumns: Record<string, Array<string | number>>;
	numericColumns: string[];
	selectedLabelColumn: string;
	selectedDataColumns: [string, string, string];
	skippedRowCount: number;
};

type BuildDatasetOptions = {
	labelColumns: string[];
	selectedLabelColumn?: string;
	dataColumns: [string, string, string];
};

function parseDelimitedLine(line: string, delimiter: string): string[] {
	const cells: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		const next = line[i + 1];

		if (char === '"') {
			if (inQuotes && next === '"') {
				current += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
			}
			continue;
		}

		if (char === delimiter && !inQuotes) {
			cells.push(current.trim());
			current = '';
			continue;
		}

		current += char;
	}

	cells.push(current.trim());
	return cells;
}

function detectDelimiter(lines: string[]): string {
	let bestDelimiter: string = DELIMITER_CANDIDATES[0];
	let bestScore = -Infinity;

	for (const delimiter of DELIMITER_CANDIDATES) {
		const widths = lines.map((line) => parseDelimitedLine(line, delimiter).length);
		const maxWidth = Math.max(...widths);
		const repeatedWidthCount = widths.filter((width) => width === maxWidth).length;
		const score = maxWidth * repeatedWidthCount;

		if (maxWidth > 1 && score > bestScore) {
			bestDelimiter = delimiter;
			bestScore = score;
		}
	}

	return bestDelimiter;
}

function isNumericCell(value: string): boolean {
	if (value.trim() === '') return false;
	return Number.isFinite(Number(value));
}

function detectHeader(rows: string[][]): boolean {
	if (rows.length < 2) return false;

	const firstRow = rows[0];
	const bodyRows = rows.slice(1, Math.min(rows.length, 8));
	const firstNumericRatio = firstRow.filter(isNumericCell).length / Math.max(firstRow.length, 1);
	const bodyCells = bodyRows.flat();
	const bodyNumericRatio = bodyCells.filter(isNumericCell).length / Math.max(bodyCells.length, 1);

	return firstNumericRatio < 0.5 && bodyNumericRatio > 0.5;
}

function makeUniqueColumnNames(rawColumns: string[]): string[] {
	const seen = new Map<string, number>();

	return rawColumns.map((rawColumn, index) => {
		const fallback = `Column ${index}`;
		const baseName = rawColumn.trim() || fallback;
		const seenCount = seen.get(baseName) ?? 0;
		seen.set(baseName, seenCount + 1);
		return seenCount === 0 ? baseName : `${baseName} (${seenCount + 1})`;
	});
}

function normalizeRows(rows: string[][]): string[][] {
	const width = Math.max(...rows.map((row) => row.length));
	return rows.map((row) => {
		const normalized = row.slice(0, width);
		while (normalized.length < width) normalized.push('');
		return normalized;
	});
}

export function parseDelimitedFile(text: string, fileName: string): ParsedDelimitedFile {
	const lines = text
		.replace(/^\uFEFF/, '')
		.split(/\r?\n/)
		.map((line) => line.trimEnd())
		.filter((line) => line.trim() !== '');

	if (lines.length === 0) {
		throw new Error('The selected file is empty.');
	}

	const delimiter = detectDelimiter(lines.slice(0, 12));
	const rows = normalizeRows(lines.map((line) => parseDelimitedLine(line, delimiter)));

	if (rows[0].length < 3) {
		throw new Error('The file must contain at least three columns.');
	}

	return {
		fileName,
		rows,
		delimiter,
		detectedHasHeader: detectHeader(rows)
	};
}

export function createUploadedTable(
	parsedFile: ParsedDelimitedFile,
	hasHeader: boolean
): UploadedTable {
	const rawColumns = hasHeader
		? parsedFile.rows[0]
		: parsedFile.rows[0].map((_, index) => String(index));
	const rows = hasHeader ? parsedFile.rows.slice(1) : parsedFile.rows;

	if (rows.length === 0) {
		throw new Error('The file has column names but no data rows.');
	}

	return {
		fileName: parsedFile.fileName,
		columns: makeUniqueColumnNames(rawColumns),
		rows,
		delimiter: parsedFile.delimiter,
		hasHeader
	};
}

export function getNumericColumnNames(table: UploadedTable): string[] {
	return table.columns.filter((_, columnIndex) =>
		table.rows.every((row) => isNumericCell(row[columnIndex] ?? ''))
	);
}

export function inferLabelType(labels: Array<string | number>): DatasetResult['type'] {
	if (labels.length === 0) return 'categorical';
	return labels.every((label) => Number.isFinite(Number(label))) ? 'continuous' : 'categorical';
}

function coerceLabelValues(values: string[]): Array<string | number> {
	const normalizedValues = values.map((value) => value.trim());
	const allNumeric = normalizedValues.every(isNumericCell);

	if (allNumeric) {
		return normalizedValues.map((value) => Number(value));
	}

	return normalizedValues.map((value) => value || '(missing)');
}

function scaleDataForDefault3DView(data: number[][]): number[][] {
	const minValues = [Infinity, Infinity, Infinity];
	const maxValues = [-Infinity, -Infinity, -Infinity];

	for (const point of data) {
		for (let axis = 0; axis < 3; axis++) {
			const value = point[axis];
			if (value < minValues[axis]) minValues[axis] = value;
			if (value > maxValues[axis]) maxValues[axis] = value;
		}
	}

	return data.map((point) =>
		point.map((value, axis) => {
			const minValue = minValues[axis];
			const maxValue = maxValues[axis];
			const span = maxValue - minValue;
			if (!Number.isFinite(span) || span === 0) return 0;

			const midpoint = (minValue + maxValue) / 2;
			return ((value - midpoint) / span) * UPLOADED_VIEW_HALF_EXTENT * 2;
		})
	);
}

export function buildUploadedDataset(
	table: UploadedTable,
	options: BuildDatasetOptions
): UploadedDatasetBundle {
	const dataColumnIndexes = options.dataColumns.map((column) => table.columns.indexOf(column));
	const labelColumnIndexes = options.labelColumns.map((column) => table.columns.indexOf(column));
	const selectedLabelColumn = options.selectedLabelColumn || options.labelColumns[0] || '';

	if (dataColumnIndexes.some((index) => index === -1)) {
		throw new Error('One or more selected data columns no longer exist.');
	}

	if (labelColumnIndexes.some((index) => index === -1)) {
		throw new Error('One or more selected label columns no longer exist.');
	}

	const data: number[][] = [];
	const rawLabelsByColumn: Record<string, string[]> = Object.fromEntries(
		options.labelColumns.map((column) => [column, []])
	);
	let skippedRowCount = 0;

	for (const row of table.rows) {
		const values = dataColumnIndexes.map((index) => Number(row[index]));
		if (values.some((value) => !Number.isFinite(value))) {
			skippedRowCount++;
			continue;
		}

		data.push(values);
		options.labelColumns.forEach((column, columnIndex) => {
			rawLabelsByColumn[column].push(row[labelColumnIndexes[columnIndex]] ?? '');
		});
	}

	if (data.length === 0) {
		throw new Error('No rows contain valid numeric values for the selected data columns.');
	}

	const scaledData = scaleDataForDefault3DView(data);
	const labelColumns = Object.fromEntries(
		Object.entries(rawLabelsByColumn).map(([column, values]) => [column, coerceLabelValues(values)])
	);
	const selectedLabels = selectedLabelColumn ? labelColumns[selectedLabelColumn] : null;
	const labels = selectedLabels ?? Array.from({ length: data.length }, () => DEFAULT_LABEL);

	return {
		table,
		labelColumns,
		numericColumns: getNumericColumnNames(table),
		selectedLabelColumn: selectedLabels ? selectedLabelColumn : '',
		selectedDataColumns: options.dataColumns,
		skippedRowCount,
		dataset: {
			name: `Uploaded: ${table.fileName}`,
			type: inferLabelType(labels),
			data: scaledData,
			labels,
			source: 'uploaded'
		}
	};
}
