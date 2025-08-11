<script lang="ts">
  let { keyString, selected }: { keyString: string; selected?: boolean } =
    $props();

  let keyMap: { [key: string]: string } = {
    meta: "⌘",
    shift: "⇧",
    alt: "⌥",
    ctrl: "⌃",
  };

  let keys = $derived(
    keyString.split(" ").map((key) => {
      return keyMap[key] ?? key;
    })
  );
</script>

<div class="top" class:selected>
  {#each keys as key}
    <div class="key">{key}</div>
  {/each}
</div>

<style>
  .top {
    display: flex;
    flex-direction: row;
    gap: 4px;
  }
  .key {
    color: var(--text);
    background-color: var(--back-2);
    border-radius: 4px;
    font-size: 0.8rem;
    width: 20px;
    height: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .selected .key {
    background-color: var(--back-3);
  }
</style>
