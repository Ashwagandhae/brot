<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import type { CommandProvider } from "./command";
  import CommandChoice from "./CommandChoice.svelte";
  import TextBar from "./TextBar.svelte";
  import type { PaletteAction } from "../../src-tauri/bindings/PaletteAction";
  import type { PartialAction } from "../../src-tauri/bindings/PartialAction";
  import type { MatchedPaletteAction } from "../../src-tauri/bindings/MatchedPaletteAction";

  let {
    provider,
    onaccept,
    oncancel,
  }: {
    provider: CommandProvider;

    onaccept?: (command: PartialAction) => void;
    oncancel?: () => void;
  } = $props();

  let search: string = $state("");

  let selectedIndex: number = $state(0);
  let commands: MatchedPaletteAction[] = $state([]);

  $effect(() => {
    (async () => {
      commands = await provider.search(search);
    })();
  });

  $effect(() => {
    commands;
    selectedIndex = 0;
  });

  onDestroy(() => {
    stop?.();
  });

  function handleKeydown(event: KeyboardEvent) {
    if (event.key == "ArrowUp") {
      selectedIndex -= 1;
      event.preventDefault();
    } else if (event.key == "ArrowDown") {
      selectedIndex += 1;
      event.preventDefault();
    }
    selectedIndex = Math.max(0, Math.min(commands.length - 1, selectedIndex));
  }
</script>

<div class="outer">
  <div class="content">
    <TextBar
      bind:value={search}
      flat
      autofocus
      {oncancel}
      onaccept={() => {
        if (selectedIndex >= commands.length) {
          oncancel?.();
          return;
        }
        onaccept?.(commands[selectedIndex].paletteAction.action);
      }}
      onkeydown={handleKeydown}
    ></TextBar>
    <div class="choices">
      {#each commands as command, index}
        <CommandChoice
          selected={selectedIndex == index}
          command={command.paletteAction}
        ></CommandChoice>
      {/each}
    </div>
  </div>
</div>

<style>
  div.outer {
    top: 0;
    width: 100vw;
    height: 100vh;
    position: fixed;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 20vh;
    box-sizing: border-box;
  }

  .content {
    width: 100%;
    max-width: 300px;
    box-sizing: border-box;
    background: var(--back-1);
    border-radius: 8px;
  }
</style>
