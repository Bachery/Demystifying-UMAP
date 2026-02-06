<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	export const prerender = true;
	export const ssr = false; // client-side rendering only, since this involves many WebGL and computations
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
