<script lang="ts">
	const githubUrl = 'https://github.com/Bachery/Demystifying-UMAP';
	const paperUrl = 'https://journals.sagepub.com/doi/10.1177/14738716261434908';
</script>

<header
	class="relative z-20 border-b border-white/70 bg-white/75 px-4 py-3 shadow-[0_12px_32px_rgba(148,163,184,0.14)] backdrop-blur-xl sm:px-6"
>
	<div
		class="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-sky-200 via-white to-indigo-200"
	></div>

	<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
		<div class="min-w-0">
			<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
				<h1 class="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
					Demystifying UMAP Artifacts
				</h1>
				<div class="flex flex-wrap items-center gap-2">
					<a
						href="https://pacificvis2026.github.io/"
						target="_blank"
						class="hidden rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-bold tracking-wider text-blue-600 uppercase transition-colors hover:bg-blue-100 sm:block"
						title="Accepted by PacificVis 2026 & Information Visualization"
					>
						PacificVis 2026
					</a>
					<a
						href="https://vismeetsai.github.io/"
						target="_blank"
						class="hidden rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-bold tracking-wider text-blue-600 uppercase transition-colors hover:bg-blue-100 sm:block"
						title="Accepted by PacificVis 2026 & Information Visualization"
					>
						Vis Meets AI 2026
					</a>
				</div>
			</div>
			<p class="mt-1 max-w-3xl text-xs leading-5 text-slate-500 sm:text-sm">
				Explore UMAP artifacts through linked 3D probes, 2D embeddings, and human-in-the-loop layout
				steering.
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-2 sm:gap-3">
			<a
				href={paperUrl}
				target="_blank"
				rel="noreferrer"
				class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-900 hover:shadow-md"
			>
				<svg
					class="h-4 w-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.7"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path
						d="M7 3.75h6.5L18.25 8.5V19a1.25 1.25 0 0 1-1.25 1.25H7A1.25 1.25 0 0 1 5.75 19V5A1.25 1.25 0 0 1 7 3.75Z"
					/>
					<path d="M13.5 3.75V8.5h4.75" />
					<path d="M8.75 11h6.5" />
					<path d="M8.75 14h6.5" />
					<path d="M8.75 17h4" />
				</svg>
				Paper
			</a>

			<a
				href={githubUrl}
				target="_blank"
				rel="noreferrer"
				class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-900 hover:shadow-md"
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path
						d="M12 2C6.477 2 2 6.596 2 12.266c0 4.537 2.865 8.387 6.839 9.745.5.095.682-.221.682-.49 0-.24-.009-.876-.014-1.719-2.782.615-3.369-1.377-3.369-1.377-.455-1.177-1.11-1.49-1.11-1.49-.908-.636.068-.624.068-.624 1.004.072 1.532 1.06 1.532 1.06.892 1.57 2.341 1.117 2.91.854.091-.664.349-1.117.635-1.374-2.221-.259-4.556-1.14-4.556-5.074 0-1.121.39-2.038 1.029-2.757-.103-.259-.446-1.3.098-2.711 0 0 .84-.276 2.75 1.053A9.303 9.303 0 0112 6.836a9.27 9.27 0 012.504.347c1.909-1.33 2.747-1.053 2.747-1.053.546 1.412.203 2.453.1 2.711.64.719 1.027 1.636 1.027 2.757 0 3.944-2.339 4.812-4.566 5.066.359.317.679.942.679 1.898 0 1.371-.013 2.476-.013 2.814 0 .271.18.589.688.489C19.138 20.649 22 16.8 22 12.266 22 6.596 17.523 2 12 2z"
					/>
				</svg>
				GitHub
			</a>
		</div>
	</div>
</header>
