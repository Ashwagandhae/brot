<script lang="ts">
  import circle from "./icons/circle.svg?raw";

  let { name }: { name: string } = $props();
  let iconPromise: Promise<string | null> = $derived.by(async () => {
    try {
      return (await import(`./icons/${name}.svg?raw`)).default;
    } catch (e) {
      console.warn(`Icon "${name}" not found`);
      return null;
    }
  });
</script>

{#await iconPromise}
  {@html circle}
{:then icon}
  {#if icon == null}
    {@html circle}
  {:else}
    {@html icon}
  {/if}
{/await}
