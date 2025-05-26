<script lang="ts">
  import { page } from "$app/state";
  import Commands from "$lib/CommandPalette.svelte";
  import NoteView from "$lib/NoteView.svelte";
  import WindowButtons from "$lib/WindowButtons.svelte";
  import { getActionRegistryContext } from "$lib/command.js";
  import { getLocaterContext } from "$lib/locater";

  let locater = getLocaterContext();
  let actionRegistry = getActionRegistryContext();

  let path = $derived(page.url.searchParams.get("p") ?? "");
  $effect(() => {
    $locater = { type: "Note", path };
  });

  let editTitle: () => void = $state(() => {});
  let currentTitle: () => string | null = $state(() => null);

  $effect(() => {
    $actionRegistry.editTitle = editTitle;
    $actionRegistry.currentTitle = currentTitle;
  });
</script>

<WindowButtons>
  {#key path}
    <NoteView {path} bind:editTitle bind:currentTitle></NoteView>
  {/key}
</WindowButtons>
