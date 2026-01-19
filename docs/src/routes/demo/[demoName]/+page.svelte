<script lang="ts">
	import { onMount } from "svelte";
	import { page } from "$app/state";
	import { demoNames } from "$lib/demos-list";

	let error: string | null = null;

	onMount(async () => {
		const demoName = page.params.demoName;
		if (!demoNames.includes(demoName)) {
			error = "Invalid demo name.";
			return;
		}
		try {
			const demoModule = (await import(
				`../../../lib/demos/${demoName}.ts`
			)) as {
				default: () => void;
			};
			if (typeof demoModule.default === "function") {
				// If the demo exports a function, call it to mount the demo
				demoModule.default();
			} else {
				error = "Demo file does not export a default function.";
			}
		} catch (e) {
			error = `Could not load demo ${demoName} : ${String(e)}`;
		}
	});
</script>

{#if error}
	<p style="color: red">{error}</p>
{:else}
	<div id="demo-container"></div>
{/if}
