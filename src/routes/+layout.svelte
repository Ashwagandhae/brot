<script lang="ts">
  import "@fontsource-variable/atkinson-hyperlegible-next";
  import "@fontsource-variable/jetbrains-mono";

  import "../global.css";
  import { errorMessage } from "$lib/error";
  import {
    getPlatformName,
    openExternal,
    platform,
    sendCompleteSearch,
    updateWindowState,
  } from "$lib/platform";
  import CommandPalette from "$lib/CommandPalette.svelte";
  import {
    stateFromType,
    type CommandPaletteType,
    type CommandProvider,
  } from "$lib/command";
  import { goto } from "$app/navigation";

  import {
    setViewStateContext,
    toLocater,
    type ViewState,
  } from "$lib/viewState";
  import { writable, type Writable } from "svelte/store";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { onMount, tick } from "svelte";
  import type { PartialAction } from "../../src-tauri/bindings/PartialAction";
  import {
    ActionRegistryManager,
    continuePartialAction,
    setActionRegistryContext,
    type ActionRegistry,
    type ArgType,
  } from "$lib/actions";
  import type { Locater } from "../../src-tauri/bindings/Locater";
  import type { Actions } from "../../src-tauri/bindings/Actions";
  import { mapKeydownEventToAction } from "$lib/shortcut";
  import { listen } from "@tauri-apps/api/event";
  import { msg } from "$lib/message";
  import { runLastAction, setLastAction } from "$lib/lastAction";
  import WindowButtons from "$lib/WindowButtons.svelte";
  import { locaterToUrl } from "$lib/locater";
  import { invoke } from "@tauri-apps/api/core";

  let { children } = $props();

  let commandPaletteType: CommandPaletteType | null = $state(null);

  let viewState: Writable<ViewState | null> = writable(null);
  setViewStateContext(viewState);

  let registry: ActionRegistryManager = new ActionRegistryManager();
  setActionRegistryContext(registry);

  let handleKeydown: (event: KeyboardEvent) => void = $state(() => {});
  let actions: Actions | null = $state(null);

  onMount(async () => {
    $platform = await getPlatformName();
    actions = await msg("getActions");
    if ($platform == "window") {
      await listen("search", () => {
        if ($viewState == null) return;
        if (toLocater($viewState) == "pinned") {
          searchPalette = true;
          commandPaletteType = { type: "palette", key: "search" };
        }
      });
      await invoke("set_event_ready");
    }
  });

  $effect(() => {
    if (actions == null) return;
    let mapper = mapKeydownEventToAction(actions);
    handleKeydown = (event: KeyboardEvent) => {
      let action = mapper(event);
      if (action == null) return;
      setLastAction(action);
      runPartialAction(action);
    };
  });

  let title: string | null = $derived.by(() => {
    if ($viewState == null) return null;
    switch ($viewState.type) {
      case "note":
        return registry.get("getNoteTitle")?.() ?? "note not found";
      case "pinned":
        return "pinned";
      case "settings":
        return "settings";
      case "new":
        return "new";
    }
  });

  $effect(() => {
    if (title == null) return;
    if ($platform != "window") return;
    getCurrentWindow().setTitle(title);
  });
  registry.add({
    goto: (shouldOpenExternal, locater: Locater) => {
      if (shouldOpenExternal) {
        openExternal(locater);
      } else {
        goto(locaterToUrl(locater));
      }
      return;
    },
    saveWindowState: () => {
      if ($viewState == null) return;
      updateWindowState(toLocater($viewState));
      return;
    },
    openPalette: (paletteType) => {
      commandPaletteType = { type: "palette", key: paletteType };
    },
    toggleFloating: () => {
      let win = getCurrentWindow();
      win.isAlwaysOnTop().then((val) => {
        win.setAlwaysOnTop(!val);
      });
    },
    refresh: async () => {
      await msg("refresh");
      actions = await msg("getActions");
      registry.get("refreshPage")?.();
    },
    historyBack: () => {
      history.back();
    },
    historyForward: () => {
      history.forward();
    },
    repeatLastAction: () => {
      runLastAction(runPartialAction);
    },
  });

  let commandProvider: CommandProvider | null = $derived.by(() => {
    if (commandPaletteType == null) return null;
    return stateFromType(commandPaletteType, registry);
  });

  async function handleCommandPaletteFinish(action: PartialAction | null) {
    if (commandPaletteType == null) return;
    if (searchPalette) {
      completeSearch(action != null);
    }
    commandPaletteType = null;
    if (action != null) {
      setLastAction(action);
    }
    await tick(); // wait until command palette destroyed
    registry.get("focusNote")?.();
    await new Promise((resolve) => setTimeout(resolve, 0)); // yield to event loop so that note is finished focusing before action
    if (action != null) {
      runPartialAction(action);
    }
  }

  let runPartialAction = $derived((action: PartialAction) => {
    continuePartialAction(registry, action, (argType) => {
      commandPaletteType = {
        type: "arg",
        argType,
        action,
      };
    });
  });

  let searchPalette: boolean = $state(false);
  async function completeSearch(accepted: boolean) {
    searchPalette = false;
    sendCompleteSearch(accepted);
  }
</script>

<svelte:head>
  {#if title != null}
    <title>{title}</title>
  {:else}
    <title>brot</title>
  {/if}
</svelte:head>
<svelte:document onkeydown={handleKeydown} />
<WindowButtons {runPartialAction} paletteActive={commandPaletteType != null}>
  {@render children()}
</WindowButtons>
{#if $errorMessage != null}
  <p class="err">{$errorMessage}</p>
{/if}

{#key commandPaletteType}
  {#if commandProvider != null}
    <CommandPalette
      provider={commandProvider}
      onfinish={handleCommandPaletteFinish}
      hideBack={searchPalette}
    ></CommandPalette>
  {/if}
{/key}

<style>
  .err {
    color: red;
    position: fixed;
    bottom: 0;
    z-index: 9999;
  }
</style>
