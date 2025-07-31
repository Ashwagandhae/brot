<script lang="ts">
  import type { PaletteAction } from "../../src-tauri/bindings/PaletteAction";
  import Icon from "./Icon.svelte";

  let { command, selected }: { command: PaletteAction; selected: boolean } =
    $props();
</script>

<div class="top" class:selected>
  <div class="icon"><Icon name={command.icon ?? "dots"}></Icon></div>
  <div class="title">
    {command.title}
  </div>
</div>

<style>
  .top {
    width: 100%;
    font-size: 16px;
    height: 32px;
    line-height: 1;
    box-sizing: border-box;
    border-radius: 8px;
    background: var(--back-1);

    display: flex;
    flex-direction: row;
    /* gap: 8px; */
  }
  .title {
    padding: 8px;
    padding-left: 0;
  }
  .icon {
    width: 16px;
    height: 16px;
    padding: 8px;
  }
  .top.selected {
    background: var(--back-2);
  }
</style>
