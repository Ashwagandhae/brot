<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import type { CommandProvider } from "./command";
  import CommandChoice from "./CommandChoice.svelte";
  import TextBar from "./TextBar.svelte";
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

  let previousFocus: Element | null = null;
  onMount(() => {
    previousFocus = document.activeElement;
    textElement?.focus();
  });

  let search: string = $state("");

  let selectedIndex: number = $state(0);
  let commands: MatchedPaletteAction[] = $state([]);

  $effect(() => {
    (async () => {
      commands = await provider.search(search, 0, 10);
    })();
  });

  $effect(() => {
    search;
    selectedIndex = 0;
  });

  onDestroy(() => {
    stop?.();
    if (previousFocus == null) return;
    if (previousFocus instanceof HTMLElement) {
      previousFocus.focus();
    }
  });

  async function handleKeydown(event: KeyboardEvent) {
    let newSelectedIndex = selectedIndex;
    if (event.key == "ArrowUp") {
      newSelectedIndex -= 1;
      event.preventDefault();
    } else if (event.key == "ArrowDown") {
      newSelectedIndex += 1;
      event.preventDefault();
    }
    if (newSelectedIndex >= commands.length) {
      let newCommands = await provider.search(
        search,
        commands.length,
        commands.length + 10
      );
      commands = [...commands, ...newCommands];
    }
    selectedIndex = Math.max(
      0,
      Math.min(commands.length - 1, newSelectedIndex)
    );
  }

  let choices: HTMLElement | null = $state(null);
  let textElement: HTMLElement | undefined = $state(undefined);
</script>

<div class="outer">
  <div class="content">
    <TextBar
      bind:value={search}
      bind:element={textElement}
      flat
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
    <div class="choices" bind:this={choices}>
      {#each commands as command, index (index)}
        <CommandChoice
          selected={selectedIndex == index}
          {command}
          container={choices}
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
    max-width: 350px;
    box-sizing: border-box;
    background: var(--back-1);
    border-radius: 8px;
  }
  div.choices {
    max-height: calc(32px * 10);
    overflow: scroll;
  }
</style>
