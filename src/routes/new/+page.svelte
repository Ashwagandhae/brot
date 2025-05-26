<script lang="ts">
  import { goto } from "$app/navigation";
  import { getLocaterContext } from "$lib/locater";
  import { createNote } from "$lib/message";
  import TextBar from "$lib/TextBar.svelte";
  import WindowButtons from "$lib/WindowButtons.svelte";
  import { onMount } from "svelte";

  let locater = getLocaterContext();
  $locater = { type: "New" };

  let title = $state("");

  async function createAndGotoNote() {
    let path = await createNote(title);
    goto("./note?p=" + path);
  }
  let element: HTMLElement | undefined = $state(undefined);
  onMount(() => {
    setTimeout(() => {
      element?.focus();
    }, 50);
  });
</script>

<WindowButtons>
  <div class="top">
    <div class="titleBar">
      <TextBar
        bind:value={title}
        placeholder={"title"}
        onaccept={createAndGotoNote}
        autofocus
        bind:element
      ></TextBar>
    </div>
  </div>
</WindowButtons>

<style>
  .top {
    display: flex;
    flex-direction: column;
    width: 100%;
    align-items: center;
  }

  .titleBar {
    top: 0;
    position: sticky;

    display: flex;
    flex-direction: row;

    padding: 4px;
    pointer-events: all;
    width: max-content;
    height: 28px;
    box-sizing: border-box;
    overflow: visible;

    z-index: 10;
  }
</style>
