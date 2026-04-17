<script lang="ts">
	type Props = {
		open: boolean;
		filename: string;
		durationSeconds: number;
		includeGrid: boolean;
		saving?: boolean;
		onCancel: () => void;
		onFilenameChange: (value: string) => void;
		onDurationChange: (value: number) => void;
		onIncludeGridChange: (value: boolean) => void;
		onSave: () => void | Promise<void>;
	};

	let {
		open,
		filename,
		durationSeconds,
		includeGrid,
		saving = false,
		onCancel,
		onFilenameChange,
		onDurationChange,
		onIncludeGridChange,
		onSave
	}: Props = $props();

	let hasValidDuration = $derived(Number.isFinite(durationSeconds) && durationSeconds > 0);
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm"
		role="presentation"
		onclick={(event) => {
			if (event.target === event.currentTarget && !saving) onCancel();
		}}
	>
		<div
			class="w-full max-w-sm rounded-xl border border-gray-200 bg-white shadow-2xl"
			role="dialog"
			aria-modal="true"
			aria-label="Save Morph Animation"
		>
			<form
				class="p-5"
				onsubmit={(event) => {
					event.preventDefault();
					if (filename.trim() && hasValidDuration && !saving) void onSave();
				}}
			>
				<h3 class="text-base font-semibold text-gray-900">Save Morph Animation</h3>
				<p class="mt-1 text-xs text-gray-500">
					Export the 2D view while animation progress moves from 0% to 100%.
				</p>

				<label class="mt-4 block text-xs font-medium tracking-wide text-gray-500 uppercase">
					Duration (seconds)
					<input
						type="number"
						min="0.1"
						step="0.1"
						class="mt-1 w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
						value={durationSeconds}
						disabled={saving}
						oninput={(event) => onDurationChange(Number(event.currentTarget.value))}
					/>
				</label>

				<label class="mt-4 block text-xs font-medium tracking-wide text-gray-500 uppercase">
					File name
					<input
						class="mt-1 w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
						value={filename}
						placeholder="morph-animation.webm"
						disabled={saving}
						oninput={(event) => onFilenameChange(event.currentTarget.value)}
					/>
				</label>

				<label class="mt-4 flex cursor-pointer items-center gap-2 text-sm text-gray-700">
					<input
						type="checkbox"
						class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						checked={includeGrid}
						disabled={saving}
						onchange={(event) => onIncludeGridChange(event.currentTarget.checked)}
					/>
					Save grid in video
				</label>

				<div class="mt-5 flex justify-end gap-2">
					<button
						type="button"
						class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
						disabled={saving}
						onclick={onCancel}
					>
						Cancel
					</button>
					<button
						type="submit"
						class="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
						disabled={!filename.trim() || !hasValidDuration || saving}
					>
						{saving ? 'Saving...' : 'Save'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
