<script lang="ts">
  import "@fontsource-variable/atkinson-hyperlegible-next";
  import "../global.css";
  import { errorMessage } from "$lib/error";
  import { initPlatformName, platform } from "$lib/platform";
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
  import { invoke } from "@tauri-apps/api/core";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { onMount } from "svelte";
  import type { PartialAction } from "../../src-tauri/bindings/PartialAction";
  import {
    continuePartialAction,
    setActionRegistryContext,
    type ActionRegistry,
    type ArgType,
  } from "$lib/actions";
  import type { Locater } from "../../src-tauri/bindings/Locater";
  import type { Actions } from "../../src-tauri/bindings/Actions";
  import { mapKeydownEventToAction } from "$lib/shortcuts";
  import { listen } from "@tauri-apps/api/event";
  import { msg } from "$lib/message";

  let { children } = $props();

  let commandPaletteType: CommandPaletteType | null = $state(null);

  let viewState: Writable<ViewState | null> = writable(null);
  setViewStateContext(viewState);

  let registry: Writable<ActionRegistry> = writable({});
  setActionRegistryContext(registry);

  let handleKeydown: (event: KeyboardEvent) => void = $state(() => {});
  let actions: Actions | null = $state(null);
  onMount(async () => {
    await initPlatformName();
    actions = await msg("getActions");
    if ($platform == "window") {
      await listen("search", () => {
        if ($viewState == null) return;
        if (toLocater($viewState) == "pinned") {
          searchPalette = true;
          commandPaletteType = { type: "palette", key: "search" };
        }
      });
    }
  });

  $effect(() => {
    if (actions == null) return;
    let mapper = mapKeydownEventToAction(actions);
    handleKeydown = (event: KeyboardEvent) => {
      let action = mapper(event);
      if (action == null) return;
      continuePartialAction($registry, action, (arg) =>
        requestNextParam(arg, action)
      );
    };
  });

  let title: string | null = $derived.by(() => {
    if ($viewState == null) return null;
    switch ($viewState.type) {
      case "note":
        return $registry?.getNoteTitle?.() ?? "note not found";
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

  $registry.goto = (newWindow, locater: Locater) => {
    if (newWindow) {
      invoke("open_window", { locater });
    } else {
      if (locater == "pinned") {
        goto("/");
      } else if (locater == "settings") {
        goto("/settings");
      } else if (locater == "new") {
        goto("/new");
      } else {
        goto("/note?p=" + locater.slice(5));
      }
    }
    return;
  };
  $registry.saveWindowState = () => {
    if ($viewState == null) return;
    invoke("update_window_state", { locater: toLocater($viewState) });
    return;
  };
  $registry.openPalette = (paletteType) => {
    commandPaletteType = { type: "palette", key: paletteType };
  };
  $registry.toggleFloating = () => {
    let win = getCurrentWindow();
    win.isAlwaysOnTop().then((val) => {
      win.setAlwaysOnTop(!val);
    });
  };
  $registry.refresh = async () => {
    await msg("refresh");
    actions = await msg("getActions");
    $registry?.refreshPage?.();
  };

  let commandProvider: CommandProvider | null = $derived.by(() => {
    if (commandPaletteType == null) return null;
    return stateFromType(commandPaletteType);
  });

  function handleCommandPaletteCancel() {
    if (searchPalette) {
      completeSearch(false);
    }
    commandPaletteType = null;
  }

  function handleCommandPaletteAccept(action: PartialAction) {
    if (searchPalette) {
      completeSearch(true);
    }
    commandPaletteType = null;
    continuePartialAction($registry, action, (arg) =>
      requestNextParam(arg, action)
    );
  }

  function requestNextParam(argType: ArgType, action: PartialAction) {
    commandPaletteType = {
      type: "arg",
      argType,
      action,
    };
  }

  let searchPalette: boolean = $state(false);
  async function completeSearch(accepted: boolean) {
    searchPalette = false;
    await invoke("complete_search", { accepted });
  }
</script>

<svelte:head>
  {#if title != null}
    <title>{title}</title>
  {:else}
    <title>brot</title>
  {/if}
</svelte:head>
{@render children()}
<svelte:document onkeydown={handleKeydown} />

{#key commandPaletteType}
  {#if commandProvider != null}
    <CommandPalette
      provider={commandProvider}
      oncancel={handleCommandPaletteCancel}
      onaccept={handleCommandPaletteAccept}
    ></CommandPalette>
  {/if}
{/key}

{#if $errorMessage != null}
  <p class="err">{$errorMessage}</p>
{/if}

<style>
  .err {
    color: red;
    position: fixed;
    bottom: 0;
    z-index: 9999;
  }
</style>
