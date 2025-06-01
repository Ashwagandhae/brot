<script lang="ts">
  import { page } from "$app/state";
  import Commands from "$lib/CommandPalette.svelte";
  import NoteView from "$lib/NoteView.svelte";
  import WindowButtons from "$lib/WindowButtons.svelte";
  import {
    getActionRegistryContext,
    type NoteActionRegistry,
  } from "$lib/command.js";
  import { getViewStateContext } from "$lib/viewState";

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
</script>

<WindowButtons>
  {#key path}
    <NoteView {path} bind:registry={noteActionRegistry} focused={true}
    ></NoteView>
  {/key}
</WindowButtons>
