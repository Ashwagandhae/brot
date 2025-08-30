<script lang="ts">
  import {
    onMount,
    tick,
    type Component,
    type ComponentProps,
    type Snippet,
  } from "svelte";
  import type { Actions } from "../../src-tauri/bindings/Actions";
  import type { PartialAction } from "../../src-tauri/bindings/PartialAction";
  import {
    continuePartialAction,
    parsePartialAction,
    type ActionRegistryManager,
    type ParsedPartialAction,
  } from "./actions";
  import {
    addArg,
    paletteForArg,
    providerForPaletteKey,
    type PaletteType,
  } from "./command";
  import CommandPalette from "./CommandPalette.svelte";
  import { runLastAction, setLastAction } from "./lastAction";
  import { msg } from "./message";
  import PaletteWrapper from "./PaletteWrapper.svelte";
  import { sendCompleteSearch } from "./platform";
  import { mapKeydownEventToAction } from "./shortcut";
  import type { OpenComponentPalette } from "./componentPalette";

  let {
    registry,
    paletteActive = $bindable(),
    runAction = $bindable(),
    search = $bindable(),
    openComponentPalette = $bindable(),
  }: {
    registry: ActionRegistryManager;
    paletteActive: boolean;
    runAction: (action: ParsedPartialAction) => void;
    search: () => void;
    openComponentPalette: OpenComponentPalette;
  } = $props();

  let paletteType: PaletteType | null = $state(null);
  let searchPalette: boolean = $state(false);
  let actions: Actions | null = $state(null);

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

  openComponentPalette = (withProps) => {
    paletteType = {
      type: "component",
      withProps,
    };
  };

  search = () => {
    console.log("open search");
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
      if (event.key == "Escape") {
        handleFinish(null);
      }
      let action = mapper(event);
      if (action == null) return;
      let actionParsed = parsePartialAction(action);
      setLastAction(actionParsed);
      runAction(actionParsed);
    };
  });

  $effect(() => {
    runAction = (action: ParsedPartialAction) => {
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

  async function handleFinish(action: ParsedPartialAction | null) {
    console.log("handle finish");

    if (paletteType == null) return;
    if (searchPalette) {
      completeSearch(action != null);
    }
    console.log("setting palettetype null");
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
  {#if paletteType?.type != null}
    <PaletteWrapper hideBack={searchPalette} onclick={() => handleFinish(null)}>
      {#if paletteType.type == "component"}
        {@const { Component, props } = paletteType.withProps}
        <Component
          {...props}
          onfinish={() => {
            handleFinish(null);
          }}
        ></Component>
      {:else if paletteType.type == "palette"}
        <CommandPalette
          provider={providerForPaletteKey(paletteType.key, registry)}
          onfinish={(action) => {
            console.log("command palette finished");
            handleFinish(action == null ? null : parsePartialAction(action));
          }}
        ></CommandPalette>
      {:else}
        {@const { Component, props } = paletteForArg(paletteType.argType)}
        {@const prevAction: ParsedPartialAction = paletteType.action}
        <Component
          {...props}
          onfinish={(arg) => {
            let action = arg == null ? null : addArg(prevAction, arg);
            handleFinish(action);
          }}
        ></Component>
      {/if}
    </PaletteWrapper>
  {/if}
{/key}
