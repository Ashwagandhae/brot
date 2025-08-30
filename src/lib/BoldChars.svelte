<script lang="ts">
  let {
    text,
    indices,
    offset,
  }: { text: string; indices: number[]; offset?: number } = $props();

  let chars = $derived(text.split(""));
</script>

{#each chars as char, index}
  <span class:special={indices.includes(index + (offset ?? 0))}>{char}</span>
{/each}

<style>
  .special {
    font-weight: bold;
    color: var(--text-strong);
  }
  span {
    white-space: pre;
  }
</style>
