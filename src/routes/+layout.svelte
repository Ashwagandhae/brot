<script lang="ts">
  import "@fontsource-variable/atkinson-hyperlegible-next";
  import "../global.css";
  import { errorMessage } from "$lib/error";
  import { initPlatformName, platform } from "$lib/platform";
  import CommandPalette from "$lib/CommandPalette.svelte";
  import {
    setActionRegistryContext,
    type ActionRegistry,
    type CommandPaletteState,
  } from "$lib/command";
  import type { Command } from "../../src-tauri/bindings/Command";
  import { getCommands } from "$lib/message";
  import { goto } from "$app/navigation";
  import type { CommandPaletteType } from "../../src-tauri/bindings/CommandPaletteType";
  import type { ViewState } from "../../src-tauri/bindings/ViewState";
  import type { CommandAction } from "../../src-tauri/bindings/CommandAction";
  import { setViewStateContext, toLocater } from "$lib/viewState";
  import { writable, type Writable } from "svelte/store";
  import { invoke } from "@tauri-apps/api/core";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { onMount } from "svelte";
  import { writeText, readText } from "@tauri-apps/plugin-clipboard-manager";

  let { children } = $props();

  let commandPaletteType: CommandPaletteType | null = $state(null);

  let viewState: Writable<ViewState | null> = writable(null);
  setViewStateContext(viewState);

  onMount(() => {
    initPlatformName();
  });

  let title: string | null = $derived.by(() => {
    if ($viewState == null) return null;
    switch ($viewState.type) {
      case "Note":
        return $actionRegistry.note?.currentTitle?.() ?? null;
      case "Pinned":
        return "pinned";
      case "Settings":
        return "settings";
      case "New":
        return "new";
    }
  });

  $effect(() => {
    if (title == null) return;
    if ($platform != "window") return;
    getCurrentWindow().setTitle(title);
  });

  let actionRegistry: Writable<ActionRegistry> = writable({});
  setActionRegistryContext(actionRegistry);

  let commandPaletteState: CommandPaletteState = $derived.by(() => {
    if (commandPaletteType == null) return null;
    return {
      search: "",
      provider: async (search: string) => {
        if (commandPaletteType == null) return [];
        if ($viewState == null) return [];
        return await getCommands(search, $viewState, commandPaletteType);
      },
    };
  });

  async function handleKeydown(event: KeyboardEvent) {
    let key = event.key.toLowerCase();

    if (key == "k" && event.metaKey) {
      doCommandAction({ type: "Subcommand", subcommand: { type: "Action" } });
    }
    if (key == "t" && event.metaKey) {
      doCommandAction({
        type: "Subcommand",
        subcommand: { type: "Window", new: true },
      });
    }
    if (key == "l" && event.metaKey) {
      doCommandAction({
        type: "Subcommand",
        subcommand: { type: "Window", new: false },
      });
    }
    if (key == "s" && event.metaKey) {
      doCommandAction({ type: "SaveNote" });
    }

    if (key == "v" && event.shiftKey && event.metaKey) {
      $actionRegistry?.note?.editor?.commands.insertContent(await readText(), {
        updateSelection: true,
      });
    }

    if (key == "r" && event.metaKey) {
      doCommandAction({ type: "Refresh" });
    }
  }
  function handleCommandPaletteCancel() {
    commandPaletteType = null;
  }

  function doCommandAction(action: CommandAction) {
    switch (action.type) {
      case "Goto": {
        if (action.new_window) {
          invoke("open_window", { locater: action.target });
        } else {
          if (action.target == "pinned") {
            goto("/");
          } else if (action.target == "settings") {
            goto("/settings");
          } else if (action.target == "new") {
            goto("/new");
          } else {
            goto("/note?p=" + action.target.slice(5));
          }
        }
        return;
      }
      case "AddPinned": {
        $actionRegistry.addPinned?.(action.path, action.insertion);
        return;
      }
      case "RemovePinned": {
        $actionRegistry.removePinned?.();
        return;
      }
      case "EditTitle": {
        $actionRegistry.note?.editTitle?.();
        return;
      }
      case "Subcommand": {
        commandPaletteType = action.subcommand;
        return;
      }
      case "SaveWindowState":
        if ($viewState == null) return;
        invoke("update_window_state", { locater: toLocater($viewState) });
        return;
      case "ToggleNoteMinimized":
        $actionRegistry.note?.toggleMinimized?.();
        return;
      case "SaveNote":
        $actionRegistry.note?.save?.();
        return;
      case "Refresh":
        $actionRegistry.refresh?.();
    }
  }

  function handleCommandPaletteAccept(command: Command | null) {
    if (command == null) return;
    commandPaletteType = null;
    doCommandAction(command.action);
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
  <CommandPalette
    {commandPaletteState}
    oncancel={handleCommandPaletteCancel}
    onaccept={handleCommandPaletteAccept}
  ></CommandPalette>
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
