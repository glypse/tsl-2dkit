<script lang="ts">
	import { demoNames } from "$lib/demos-list";
</script>

<ul>
	{#each demoNames as demoName (demoName)}
		<li><a href="/demo/{demoName}">{demoName}</a></li>
	{/each}
</ul>
