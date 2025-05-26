<script lang="ts">
  import type { Command } from "../../src-tauri/bindings/Command";

  let { command, selected }: { command: Command; selected: boolean } = $props();
</script>

<div class:selected>
  {command.title}
</div>

<style>
  div {
    width: 100%;
    padding: 8px;
    font-size: 16px;
    height: 32px;
    line-height: 1;
    box-sizing: border-box;
    border-radius: 8px;
    background: var(--back-1);
  }
  div.selected {
    background: var(--back-2);
  }
</style>
