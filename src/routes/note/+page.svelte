<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import NoteView from "$lib/NoteView.svelte";
  import ScrollPadding from "$lib/ScrollPadding.svelte";
  import {
    getActionRegistryContext,
    ArgsFilter,
    ActionRegistryManager,
  } from "$lib/actions";

  import { getPathHues, setCssVarsFromHues, setPathContext } from "$lib/path";
  import { getTagConfigsContext } from "$lib/tagConfig";
  import { getViewStateContext } from "$lib/viewState";

  let viewState = getViewStateContext();

  let registry = getActionRegistryContext();

  let path = $derived(page.url.searchParams.get("p") ?? "");
  $effect(() => {
    $viewState = { type: "note", path };
  });

  registry.add(
    {
      refreshPage: async () => {
        refreshKey = !refreshKey;
      },
    },
    {
      openPalette: () =>
        new ArgsFilter([["addPinnedAbove"], ["addPinnedBelow"]]),
      removeCurrentPinned: () => ArgsFilter.alwaysMatch,
      toggleNoteMinimized: () => ArgsFilter.alwaysMatch,
    }
  );
  let noteRegistry = new ActionRegistryManager();
  registry.setOverride(noteRegistry);

  setPathContext({
    setPath: (_, to) => {
      goto("/note?p=" + to);
    },
  });

  let tagConfigs = getTagConfigsContext();
  $effect(() => {
    setCssVarsFromHues(getPathHues(path, tagConfigs()), document.body);
  });

  let refreshKey = $state(false);
</script>

{#key refreshKey}
  {#key path}
    <NoteView
      {path}
      registry={noteRegistry}
      focused={true}
      autofocus
      canMinimize={false}
    ></NoteView>
  {/key}
{/key}
<ScrollPadding
  onclick={() => {
    registry.get("focusNoteEnd")?.();
  }}
></ScrollPadding>
