<script lang="ts">
  import { onMount, tick } from "svelte";
  import { platform, sendCompleteSearch } from "./platform";
  import { invoke } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";
  import { getViewStateContext, toLocater } from "./viewState";
  import {
    providerFromPalette,
    type PaletteType,
    type CommandProvider,
  } from "./command";
  import { continuePartialAction, type ActionRegistryManager } from "./actions";
  import type { PartialAction } from "../../src-tauri/bindings/PartialAction";
  import { runLastAction, setLastAction } from "./lastAction";
  import CommandPalette from "./CommandPalette.svelte";
  import { mapKeydownEventToAction } from "./shortcut";
  import { msg } from "./message";
  import type { Actions } from "../../src-tauri/bindings/Actions";

  let {
    registry,
    paletteActive = $bindable(),
    runAction = $bindable(),
    search = $bindable(),
  }: {
    registry: ActionRegistryManager;
    paletteActive: boolean;
    runAction: (action: PartialAction) => void;
    search: () => void;
  } = $props();

  let paletteType: PaletteType | null = $state(null);
  let searchPalette: boolean = $state(false);
  let actions: Actions | null = $state(null);
  let commandProvider: CommandProvider | null = $derived.by(() => {
    if (paletteType == null) return null;
    return providerFromPalette(paletteType, registry);
  });

  registry.add({
    openPalette: (key) => {
      paletteType = { type: "palette", key };
    },
    refresh: async () => {
      await msg("refresh");
      actions = await msg("getActions");
      registry.get("refreshPage")?.();
    },
    repeatLastAction: () => {
      runLastAction(runAction);
    },
  });

  search = () => {
    searchPalette = true;
    paletteType = { type: "palette", key: "search" };
  };

  onMount(async () => {
    actions = await msg("getActions");
  });
  $effect(() => {
    paletteActive = paletteType != null;
  });

  let handleKeydown: (event: KeyboardEvent) => void = $state(() => {});
  $effect(() => {
    if (actions == null) return;
    let mapper = mapKeydownEventToAction(actions);
    handleKeydown = (event: KeyboardEvent) => {
      let action = mapper(event);
      if (action == null) return;
      setLastAction(action);
      runAction(action);
    };
  });

  $effect(() => {
    runAction = (action: PartialAction) => {
      continuePartialAction(registry, action, (argType) => {
        paletteType = {
          type: "arg",
          argType,
          action,
        };
      });
    };
  });

  async function completeSearch(accepted: boolean) {
    searchPalette = false;
    sendCompleteSearch(accepted);
  }

  async function handleCommandPaletteFinish(action: PartialAction | null) {
    if (paletteType == null) return;
    if (searchPalette) {
      completeSearch(action != null);
    }
    paletteType = null;
    if (action != null) {
      setLastAction(action);
    }
    await tick(); // wait until command palette destroyed
    registry.get("focusNote")?.();
    await new Promise((resolve) => setTimeout(resolve, 0)); // yield to event loop so that note is finished focusing before action
    if (action != null) {
      runAction(action);
    }
  }
</script>

<svelte:document onkeydown={handleKeydown} />
{#key paletteType}
  {#if commandProvider != null}
    <CommandPalette
      provider={commandProvider}
      onfinish={handleCommandPaletteFinish}
      hideBack={searchPalette}
    ></CommandPalette>
  {/if}
{/key}
