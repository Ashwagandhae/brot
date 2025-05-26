<script lang="ts">
  import { onMount } from "svelte";
  import type { Command } from "../../src-tauri/bindings/Command";
  import type { CommandProvider, CommandPaletteState } from "./command";
  import CommandChoice from "./CommandChoice.svelte";
  import TextBar from "./TextBar.svelte";

  let {
    commandPaletteState,
    onaccept,
    oncancel,
  }: {
    commandPaletteState: CommandPaletteState;

    onaccept?: (command: Command | null) => void;
    oncancel?: () => void;
  } = $props();

  let search: string = $state("");

  let selectedIndex: number = $state(0);
  let commands: Command[] = $state([]);

  $effect(() => {
    (async () => {
      if (commandPaletteState == null) return;
      commands = await commandPaletteState.provider(search);
    })();
  });

  $effect(() => {
    commands;
    selectedIndex = 0;
  });

  function handleKeydown(event: KeyboardEvent) {
    if (event.key == "ArrowUp") {
      selectedIndex -= 1;
      event.preventDefault();
    } else if (event.key == "ArrowDown") {
      selectedIndex += 1;
      event.preventDefault();
    }
    selectedIndex = Math.min(commands.length - 1, Math.max(selectedIndex, 0));
  }
</script>

{#if commandPaletteState != null}
  <div class="outer">
    <div class="content">
      <TextBar
        bind:value={search}
        flat
        autofocus
        {oncancel}
        onaccept={() => {
          if (selectedIndex < commands.length) {
            onaccept?.(commands[selectedIndex]);
          }
          return onaccept?.(null);
        }}
        onkeydown={handleKeydown}
      ></TextBar>
      <div class="choices">
        {#each commands as command, index}
          <CommandChoice selected={selectedIndex == index} {command}
          ></CommandChoice>
        {/each}
      </div>
    </div>
  </div>
{/if}

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
    padding-top: 30vh;
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
