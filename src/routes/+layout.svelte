<script lang="ts">
	import { dev } from '$app/environment';
	import { inject } from '@vercel/analytics';
	import './layout.css';
	// import favicon from '$lib/assets/favicon.svg';
	import favicon from '/static/favicon/favicon.svg';

	let { children } = $props();

	inject({ mode: dev ? 'development' : 'production' });
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
