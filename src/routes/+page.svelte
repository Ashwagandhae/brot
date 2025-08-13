<script lang="ts">
  import { onMount, untrack } from "svelte";
  import WindowButtons from "$lib/WindowButtons.svelte";
  import NoteView from "$lib/NoteView.svelte";
  import { getViewStateContext } from "$lib/viewState";
  import { msg } from "$lib/message";

  import {
    ActionRegistryManager,
    getActionRegistryContext,
    type ActionRegistry,
  } from "$lib/actions";
  import { setPathContext } from "$lib/path";

  let viewState = getViewStateContext();

  let registry = getActionRegistryContext();
  registry.add({
    addPinned: async (insertion, path) => {
      if (pinnedPaths == null) return;
      if (pinnedPaths.length == 0) {
        await msg("addPinned", { path, position: 0 });
      } else {
        let position = pinnedPaths.findIndex((path) => path == focusPath);
        if (insertion == "below") {
          position += 1;
        }
        await msg("addPinned", { path, position });
      }
      pinnedPaths = await msg("getPinned");
      refreshKey = !refreshKey;
    },
    removeCurrentPinned: async () => {
      if (focusPath == null) return;
      await msg("removePinned", { path: focusPath });
      pinnedPaths = await msg("getPinned");
    },
    refreshPage: async () => {
      pinnedPaths = await msg("getPinned");
      refreshKey = !refreshKey;
    },
    focusPinnedNote: (index) => {
      let newFocusPath = pinnedPaths?.[index];
      if (newFocusPath == null) return;
      noteActionRegistries[newFocusPath].get("focusNote")?.();
      focusPath = newFocusPath;
    },
    focusNote: () => untrack(() => registry).get("focusPinnedNote")?.(0),
  });

  let pinnedPaths: string[] | null = $state(null);
  let focusPath: string | null = $state(null);
  let noteActionRegistries: { [key: string]: ActionRegistryManager } = $state(
    {}
  );
  let minimized: { [key: string]: boolean } = $state({});
  let refreshKey = $state(false);

  setPathContext({
    setPath: (from, to) => {
      if (pinnedPaths == null) return;
      let index = pinnedPaths.indexOf(from);
      if (index == -1) return;
      pinnedPaths[index] = to;
    },
  });

  $effect(() => {
    if (focusPath == null) return;
    let otherRegistry = noteActionRegistries[focusPath];
    if (otherRegistry == null) return;
    registry.setOverride(otherRegistry);
  });

  $effect(() => {
    $viewState = { type: "pinned", focusPath: focusPath };
  });

  onMount(async () => {
    pinnedPaths = await msg("getPinned");
    if (pinnedPaths.length > 0) {
      focusPath = pinnedPaths[0];
    }
    let minimizedPinnedPaths = (await msg("getSettings")).minimizedPinnedPaths;
    minimized = {};
    for (let path of pinnedPaths) {
      minimized[path] = minimizedPinnedPaths?.includes(path) ?? false;
    }
  });

  function changeDictKeys<T>(
    dict: { [key: string]: T },
    newKeys: string[],
    defaultValue: () => T
  ): { [key: string]: T } {
    let newDict: { [key: string]: T } = {};
    for (let key of newKeys) {
      if (dict.hasOwnProperty(key)) {
        newDict[key] = dict[key];
      } else {
        newDict[key] = defaultValue();
      }
    }
    return newDict;
  }

  $effect(() => {
    if (pinnedPaths == null) return;
    noteActionRegistries = changeDictKeys(
      untrack(() => noteActionRegistries),
      pinnedPaths,
      () => {
        return new ActionRegistryManager();
      }
    );
    minimized = changeDictKeys(
      untrack(() => minimized),
      pinnedPaths,
      () => false
    );
  });

  $effect(() => {
    let minimizedPinnedPaths = Object.entries(minimized) // use state variable outside of async
      .filter(([_, minimized]) => minimized)
      .map(([path, _]) => path);
    (async () => {
      if (Object.keys(minimized).length == 0) return;
      let settings = await msg("getSettings");
      settings.minimizedPinnedPaths = minimizedPinnedPaths;
      await msg("updateSettings", { settings });
    })();
  });
</script>

{#key refreshKey}
  {#if pinnedPaths != null}
    {#each pinnedPaths as path (path)}
      {#if noteActionRegistries[path] != null}
        <NoteView
          {path}
          onfocus={() => {
            focusPath = path;
          }}
          bind:registry={noteActionRegistries[path]}
          bind:minimized={minimized[path]}
          focused={focusPath == path}
          canMinimize
        ></NoteView>
      {/if}
    {/each}
  {/if}
{/key}
<div class="scrollPadding"></div>

<style>
  .scrollPadding {
    height: calc(100vh - 64px);
  }
</style>
