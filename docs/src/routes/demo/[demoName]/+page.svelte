<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { page } from "$app/state";
	import { demoNames } from "$lib/demos-list";

	let error: string | null = null;
	let cleanup: (() => void) | null = null;

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
				default: () => Promise<undefined | (() => void)>;
			};
			if (typeof demoModule.default === "function") {
				// If the demo exports a function, call it to mount the demo
				const result = await demoModule.default();
				if (typeof result === "function") {
					cleanup = result;
				}
			} else {
				error = "Demo file does not export a default function.";
			}
		} catch (e) {
			error = `Could not load demo ${demoName} : ${String(e)}`;
		}
	});

	onDestroy(() => {
		if (cleanup) {
			cleanup();
		}
	});
</script>

{#if error}
	<p style="color: red">{error}</p>
{:else}
	<div id="demo-container"></div>
{/if}
