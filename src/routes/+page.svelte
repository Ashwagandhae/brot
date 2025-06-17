<script lang="ts">
  import { onMount, untrack } from "svelte";
  import WindowButtons from "$lib/WindowButtons.svelte";
  import NoteView from "$lib/NoteView.svelte";
  import { getViewStateContext } from "$lib/viewState";
  import { addPinned, getPinned, refresh, removePinned } from "$lib/message";

  import { getActionRegistryContext, type ActionRegistry } from "$lib/actions";

  let viewState = getViewStateContext();

  let registry = getActionRegistryContext();

  let pinnedPaths: string[] | null = $state(null);
  let focusPath: string | null = $state(null);

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
  });

  $effect(() => {
    if (pinnedPaths == null) return;
    noteActionRegistries = pinnedPaths.reduce(
      (acc, key) => {
        acc[key] = {};
        return acc;
      },
      {} as { [key: string]: ActionRegistry }
    );
  });

  let noteActionRegistries: { [key: string]: ActionRegistry } = $state({});

  let refreshKey = $state(false);
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
