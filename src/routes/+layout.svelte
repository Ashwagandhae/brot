<script lang="ts">
  import "@fontsource-variable/atkinson-hyperlegible-next";
  import "@fontsource-variable/atkinson-hyperlegible-next/wght-italic.css";
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
  import Palette from "$lib/Palette.svelte";

  let { children } = $props();

  let viewState: Writable<ViewState | null> = writable(null);
  setViewStateContext(viewState);

  let registry: ActionRegistryManager = new ActionRegistryManager();
  setActionRegistryContext(registry);

  onMount(async () => {
    $platform = await getPlatformName();
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

    toggleFloating: () => {
      let win = getCurrentWindow();
      win.isAlwaysOnTop().then((val) => {
        win.setAlwaysOnTop(!val);
      });
    },
    historyBack: () => {
      history.back();
    },
    historyForward: () => {
      history.forward();
    },
  });

  let paletteActive: boolean = $state(false);
  let runAction: (action: PartialAction) => void = $state(() => {});
</script>

<svelte:head>
  {#if title != null}
    <title>{title}</title>
  {:else}
    <title>brot</title>
  {/if}
</svelte:head>
<WindowButtons {runAction} {paletteActive}>
  {@render children()}
</WindowButtons>
{#if $errorMessage != null}
  <p class="err">{$errorMessage}</p>
{/if}

<Palette {registry} bind:paletteActive bind:runAction></Palette>

<style>
  .err {
    color: red;
    position: fixed;
    bottom: 0;
    z-index: 9999;
  }
</style>
