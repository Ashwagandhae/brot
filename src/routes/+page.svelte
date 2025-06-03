<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { onMount } from "svelte";
  import WindowButtons from "$lib/WindowButtons.svelte";
  import NoteView from "$lib/NoteView.svelte";
  import { getViewStateContext } from "$lib/viewState";
  import { addPinned, getPinned, refresh, removePinned } from "$lib/message";
  import {
    getActionRegistryContext,
    type NoteActionRegistry,
  } from "$lib/command";
  import { path } from "@tauri-apps/api";

  let view_state = getViewStateContext();

  let actionRegistry = getActionRegistryContext();

  let pinnedPaths: string[] | null = $state(null);
  let focusPath: string | null = $state(null);

  $effect(() => {
    $view_state = { type: "Pinned", focus_path: focusPath };
  });

  $effect(() => {
    $actionRegistry.addPinned = async (path, insertion) => {
      if (pinnedPaths == null) return;
      if (pinnedPaths.length == 0) {
        await addPinned(path, 0);
      } else {
        let position = pinnedPaths.findIndex((path) => path == focusPath);
        if (insertion.type == "After") {
          position += 1;
        }
        await addPinned(path, position);
      }
      pinnedPaths = await getPinned();
    };
    $actionRegistry.removePinned = async () => {
      if (focusPath == null) return;
      await removePinned(focusPath);
      pinnedPaths = await getPinned();
    };
    if (focusPath == null) return;
    $actionRegistry.note = noteActionRegistries[focusPath];
  });
  onMount(async () => {
    pinnedPaths = await getPinned();
    if (pinnedPaths.length > 0) {
      focusPath = pinnedPaths[0];
    }
  });

  $effect(() => {
    if (pinnedPaths == null) return;
    noteActionRegistries = pinnedPaths.reduce(
      (acc, key) => {
        acc[key] = {};
        return acc;
      },
      {} as { [key: string]: NoteActionRegistry }
    );
  });

  let noteActionRegistries: { [key: string]: NoteActionRegistry } = $state({});

  let refreshKey = $state(false);
  $actionRegistry.refresh = async () => {
    await refresh();
    pinnedPaths = await getPinned();
    refreshKey = !refreshKey;
  };
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
            focused={focusPath == path}
          ></NoteView>
        {/if}
      {/each}
    {/if}
  {/key}
</WindowButtons>
