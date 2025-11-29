<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";

  let { selected, children }: { selected: boolean; children: Snippet } =
    $props();
</script>

<div class="out" class:selected>
  {@render children()}
</div>

<style>
  .out {
    width: 100%;
    font-size: 16px;
    /* height: 32px; */
    line-height: 1;
    box-sizing: border-box;
    border-radius: 8px;
    background: var(--palette-back);

    display: flex;
    flex-direction: row;
  }
  .out.selected {
    background: var(--palette-back-2);
  }
</style>
