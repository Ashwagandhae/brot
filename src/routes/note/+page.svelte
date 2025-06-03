<script lang="ts">
  import { page } from "$app/state";
  import Commands from "$lib/CommandPalette.svelte";
  import NoteView from "$lib/NoteView.svelte";
  import WindowButtons from "$lib/WindowButtons.svelte";
  import {
    getActionRegistryContext,
    type NoteActionRegistry,
  } from "$lib/command.js";
  import { refresh } from "$lib/message";
  import { getViewStateContext } from "$lib/viewState";
  import { getRequest } from "@sveltejs/kit/node";

  let view_state = getViewStateContext();
  let actionRegistry = getActionRegistryContext();

  let path = $derived(page.url.searchParams.get("p") ?? "");
  $effect(() => {
    $view_state = { type: "Note", path };
  });

  let noteActionRegistry: NoteActionRegistry = $state({});

  $effect(() => {
    $actionRegistry.note = noteActionRegistry;
  });

  let refreshKey = $state(false);
  $actionRegistry.refresh = async () => {
    await refresh();
    refreshKey = !refreshKey;
  };
</script>

<WindowButtons>
  {#key refreshKey}
    {#key path}
      <NoteView {path} bind:registry={noteActionRegistry} focused={true}
      ></NoteView>
    {/key}
  {/key}
</WindowButtons>
