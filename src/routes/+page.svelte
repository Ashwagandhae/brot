<script lang="ts">
  import { onMount, untrack } from "svelte";
  import WindowButtons from "$lib/WindowButtons.svelte";
  import NoteView from "$lib/NoteView.svelte";
  import { getViewStateContext } from "$lib/viewState";
  import {
    addPinned,
    getPinned,
    getSettings,
    refresh,
    removePinned,
    setSettings,
  } from "$lib/message";

  import { getActionRegistryContext, type ActionRegistry } from "$lib/actions";
  import { pathToTitle, setPathContext } from "$lib/path";

  let viewState = getViewStateContext();

  let registry = getActionRegistryContext();

  let pinnedPaths: string[] | null = $state(null);
  let focusPath: string | null = $state(null);
  let noteActionRegistries: { [key: string]: ActionRegistry } = $state({});
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
    $viewState = { type: "pinned", focusPath: focusPath };
  });

  $effect(() => {
    $registry.addPinned = async (insertion, path) => {
      if (pinnedPaths == null) return;
      if (pinnedPaths.length == 0) {
        await addPinned(path, 0);
      } else {
        let position = pinnedPaths.findIndex((path) => path == focusPath);
        if (insertion == "below") {
          position += 1;
        }
        await addPinned(path, position);
      }
      pinnedPaths = await getPinned();
      refreshKey = !refreshKey;
    };
    $registry.removeCurrentPinned = async () => {
      if (focusPath == null) return;
      await removePinned(focusPath);
      pinnedPaths = await getPinned();
    };
    $registry.refresh = async () => {
      await refresh();
      pinnedPaths = await getPinned();
      refreshKey = !refreshKey;
    };
    if (focusPath == null) return;
    $registry.focusPinnedNote = (index) => {
      let newFocusPath = pinnedPaths?.[index];
      if (newFocusPath == null) return;
      noteActionRegistries[newFocusPath].focusNote?.();
      focusPath = newFocusPath;
    };
    $registry.focusNote = () => untrack(() => $registry)?.focusPinnedNote?.(0);
    $registry = {
      ...untrack(() => $registry),
      ...noteActionRegistries[focusPath],
    };
  });
  onMount(async () => {
    pinnedPaths = await getPinned();
    if (pinnedPaths.length > 0) {
      focusPath = pinnedPaths[0];
    }
    let minimizedPinnedPaths = (await getSettings()).minimized_pinned_paths;
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
        return {};
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
      let settings = await getSettings();
      settings.minimized_pinned_paths = minimizedPinnedPaths;
      await setSettings(settings);
    })();
  });
</script>

<WindowButtons>
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
</WindowButtons>
