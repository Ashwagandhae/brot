<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { onMount } from "svelte";
  import WindowButtons from "$lib/WindowButtons.svelte";
  import NoteView from "$lib/NoteView.svelte";
  import { getLocaterContext } from "$lib/locater";
  import { addPinned, getPinned, removePinned } from "$lib/message";
  import { getActionRegistryContext } from "$lib/command";
  import { path } from "@tauri-apps/api";

  let locater = getLocaterContext();

  let actionRegistry = getActionRegistryContext();

  let pinnedPaths: string[] | null = $state(null);
  let focusPath: string | null = $state(null);

  $effect(() => {
    $locater = { type: "Pinned", focus_path: focusPath };
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
    $actionRegistry.editTitle = () => {
      if (focusPath == null) return;
      editTitles[focusPath]?.();
    };
  });
  onMount(async () => {
    pinnedPaths = await getPinned();
    if (pinnedPaths.length > 0) {
      focusPath = pinnedPaths[0];
    }
  });

  let editTitles: { [key: string]: () => void } = $state({});
</script>

<WindowButtons>
  {#if pinnedPaths != null}
    {#each pinnedPaths as path}
      <NoteView
        {path}
        onfocus={() => {
          focusPath = path;
        }}
        bind:editTitle={editTitles[path]}
      ></NoteView>
    {/each}
  {/if}
</WindowButtons>
