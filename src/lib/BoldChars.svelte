<script lang="ts">
  let { text, indices }: { text: string; indices: number[] } = $props();

  let chars = $derived(text.split(""));
</script>

{#each chars as char, index}
  <span class:special={indices.includes(index)}>{char}</span>
{/each}

<style>
  .special {
    font-weight: bold;
    color: var(--text-strong);
  }
</style>
