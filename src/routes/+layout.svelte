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
  import type { Locater } from "../../src-tauri/bindings/Locater";
  import type { CommandAction } from "../../src-tauri/bindings/CommandAction";
  import { setLocaterContext } from "$lib/locater";
  import { writable, type Writable } from "svelte/store";
  import { invoke } from "@tauri-apps/api/core";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { onMount } from "svelte";

  let { children } = $props();

  let commandPaletteType: CommandPaletteType | null = $state(null);

  let locater: Writable<Locater | null> = writable(null);
  setLocaterContext(locater);

  onMount(() => {
    initPlatformName();
  });

  let title: string | null = $derived.by(() => {
    if ($locater == null) return null;
    switch ($locater.type) {
      case "Note":
        return $actionRegistry.currentTitle?.() ?? null;
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
        if ($locater == null) return [];
        return await getCommands(search, $locater, commandPaletteType);
      },
    };
  });

  function handleKeydown(event: KeyboardEvent) {
    let key = event.key.toLowerCase();

    if (key == "k" && event.metaKey) {
      commandPaletteType = { type: "Action" };
    }
    if (key == "t" && event.metaKey) {
      commandPaletteType = { type: "Window", new: true };
    }
    if (key == "l" && event.metaKey) {
      commandPaletteType = { type: "Window", new: false };
    }
  }
  function handleCommandPaletteCancel() {
    commandPaletteType = null;
  }

  function doCommandAction(action: CommandAction): CommandPaletteType | null {
    switch (action.type) {
      case "Goto": {
        if (action.new_window) {
          switch (action.target.type) {
            case "Note": {
              invoke("open_note", { path: action.target.path });
              break;
            }
            case "Pinned": {
              invoke("open_pinned");
              break;
            }
            case "Settings": {
              invoke("open_settings");
              break;
            }
            case "New": {
              invoke("open_new");
              break;
            }
          }
        } else {
          switch (action.target.type) {
            case "Note": {
              goto("/note?p=" + action.target.path);
              break;
            }
            case "Pinned": {
              goto("/");
              break;
            }
            case "Settings": {
              goto("/settings");
              break;
            }
            case "New": {
              goto("/new");
              break;
            }
          }
        }
        return null;
      }
      case "AddPinned": {
        $actionRegistry.addPinned?.(action.path, action.insertion);
        return null;
      }
      case "RemovePinned": {
        $actionRegistry.removePinned?.();
        return null;
      }
      case "EditTitle": {
        $actionRegistry.editTitle?.();
        return null;
      }
      case "Subcommand": {
        return {
          type: "Subcommand",
          subcommand: action.subcommand,
        };
      }
    }
  }

  function handleCommandPaletteAccept(command: Command | null) {
    if (command == null) return;
    commandPaletteType = doCommandAction(command.action);
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
