<script lang="ts">
  import "@fontsource-variable/atkinson-hyperlegible-next";
  import "@fontsource-variable/atkinson-hyperlegible-next/wght-italic.css";
  import "@fontsource-variable/jetbrains-mono";
  import "katex/dist/katex.min.css";
  import "@benrbray/prosemirror-math/dist/prosemirror-math.css";

  import { errorMessage } from "$lib/error";
  import {
    getPlatformName,
    openExternal,
    platform,
    updateWindowState,
  } from "$lib/platform";
  import "../global.css";

  import { goto } from "$app/navigation";

  import {
    ActionRegistryManager,
    setActionRegistryContext,
    type ParsedPartialAction,
  } from "$lib/actions";
  import { locaterToUrl } from "$lib/locater";
  import Palette from "$lib/Palette.svelte";
  import {
    setViewStateContext,
    toLocater,
    type ViewState,
  } from "$lib/viewState";
  import WindowButtons from "$lib/WindowButtons.svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { onDestroy, onMount } from "svelte";
  import { writable, type Writable } from "svelte/store";
  import type { Locater } from "../../src-tauri/bindings/Locater";
  import { invoke } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";
  import {
    setComponentPaletteContext,
    type OpenComponentPalette,
  } from "$lib/componentPalette";
  import { setTagConfigsContext, type TagConfigs } from "$lib/tagConfig";
  import { msg } from "$lib/message";

  let { children } = $props();

  let viewState: Writable<ViewState | null> = writable(null);
  setViewStateContext(viewState);

  let registry: ActionRegistryManager = new ActionRegistryManager();
  setActionRegistryContext(registry);

  let tagConfigs: TagConfigs = $state({});
  setTagConfigsContext(() => tagConfigs);

  let unlisten = () => {};
  onMount(async () => {
    $platform = await getPlatformName();
    if ($platform == "window") {
      unlisten = await listen("search", () => {
        if (getCurrentWindow().label != "pinned") return;
        search();
      });
      await invoke("set_event_ready");
    }
    tagConfigs = await msg("getTagConfigs");
  });
  onDestroy(() => {
    unlisten();
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

    refreshTagConfigs: async () => {
      tagConfigs = await msg("getTagConfigs");
    },
  });

  let paletteActive: boolean = $state(false);
  let runAction: (action: ParsedPartialAction) => void = $state(() => {});
  let search: () => void = $state(() => {});
  let openComponentPalette: OpenComponentPalette = $state(() => {});
  setComponentPaletteContext(() => openComponentPalette);
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

<Palette
  {registry}
  bind:paletteActive
  bind:runAction
  bind:search
  bind:openComponentPalette
></Palette>

<style>
  .err {
    color: red;
    position: fixed;
    bottom: 0;
    z-index: 9999;
  }
</style>
