<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import NoteView from "$lib/NoteView.svelte";
  import WindowButtons from "$lib/WindowButtons.svelte";
  import { getActionRegistryContext, ArgsFilter } from "$lib/actions";

  import { setPathContext } from "$lib/path";
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

  setPathContext({
    setPath: (_, to) => {
      goto("/note?p=" + to);
    },
  });

  let refreshKey = $state(false);
</script>

<WindowButtons>
  {#key refreshKey}
    {#key path}
      <NoteView {path} {registry} focused={true} autofocus canMinimize={false}
      ></NoteView>
    {/key}
  {/key}
</WindowButtons>
