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
  import { onBeforeClose } from "$lib/beforeClose";

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
      toggleNoteMinimized: () => ArgsFilter.alwaysMatch,
    },
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
  onBeforeClose(async () => {
    await noteView?.saveUnsaved();
  });

  let refreshKey = $state(false);
  let noteView: NoteView | null = $state(null);
</script>

{#key refreshKey}
  {#key path}
    <NoteView
      {path}
      registry={noteRegistry}
      focused={true}
      autofocus
      bind:this={noteView}
      canMinimize={false}
    ></NoteView>
  {/key}
{/key}
<ScrollPadding
  onclick={() => {
    registry.get("focusNoteEnd")?.();
  }}
></ScrollPadding>
