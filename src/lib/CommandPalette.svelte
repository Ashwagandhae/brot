<script lang="ts" generics="T">
  import { onDestroy } from "svelte";
  import type { CommandProvider, CommandChoice } from "./command";
  import CommandChoiceComp from "./CommandChoice.svelte";
  import TextBar from "./TextBar.svelte";

  let {
    provider,
    onfinish,
  }: {
    provider: CommandProvider<T>;
    onfinish?: (command: T | null) => void;
  } = $props();

  let search: string = $state("");

  let selectedIndex: number = $state(0);
  let commands: CommandChoice<T>[] = $state([]);

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
    onfinish?.(null);
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
</script>

<TextBar
  bind:value={search}
  autofocus
  oncancel={() => {
    onfinish?.(null);
  }}
  onaccept={() => {
    if (selectedIndex >= commands.length) {
      onfinish?.(null);
      return;
    }
    onfinish?.(commands[selectedIndex].payload);
  }}
  onkeydown={handleKeydown}
></TextBar>
<div class="choices" bind:this={choices}>
  {#each commands as command, index (index)}
    <CommandChoiceComp
      selected={selectedIndex == index}
      {command}
      container={choices}
      onclick={() => {
        onfinish?.(commands[index].payload);
      }}
    ></CommandChoiceComp>
  {/each}
</div>

<style>
  div.choices {
    max-height: calc(32px * 10);
    overflow: scroll;
  }
</style>
