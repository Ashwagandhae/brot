<script lang="ts">
  import { page } from "$app/state";
  import NoteView from "$lib/NoteView.svelte";
  import WindowButtons from "$lib/WindowButtons.svelte";
  import { getActionRegistryContext } from "$lib/actions";

  import { refresh } from "$lib/message";
  import { getViewStateContext } from "$lib/viewState";

  let viewState = getViewStateContext();

  let registry = getActionRegistryContext();

  let path = page.url.searchParams.get("p") ?? "";
  $effect(() => {
    $viewState = { type: "note", path };
  });

  $effect(() => {
    $registry.refresh = async () => {
      await refresh();
      refreshKey = !refreshKey;
    };
  });

  let refreshKey = $state(false);
</script>

<WindowButtons>
  {#key refreshKey}
    {#key path}
      <NoteView {path} bind:registry={$registry} focused={true}></NoteView>
    {/key}
  {/key}
</WindowButtons>
