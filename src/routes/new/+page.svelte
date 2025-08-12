<script lang="ts">
  import { goto } from "$app/navigation";
  import { getViewStateContext } from "$lib/viewState";
  import TextBar from "$lib/TextBar.svelte";
  import { onMount } from "svelte";
  import { msg } from "$lib/message";
  import Icon from "$lib/Icon.svelte";
  import { platform } from "$lib/platform";

  let viewState = getViewStateContext();
  $viewState = { type: "new" };

  let title = $state("");

  async function createAndGotoNote() {
    let path = await msg("createNote", { title });
    console.log("created note with path:", path);
    if (path == null) return;
    goto(`./note?p=${path}`);
  }
  let element: HTMLElement | undefined = $state(undefined);
  onMount(() => {
    setTimeout(() => {
      element?.focus();
    }, 50);
  });
</script>

<div class="top">
  <div class="titleBar">
    <TextBar
      bind:value={title}
      placeholder={"title"}
      onaccept={createAndGotoNote}
      autofocus
      bind:element
    ></TextBar>
    {#if $platform == "android"}
      <button onclick={createAndGotoNote}>
        <div class="icon">
          <Icon name="check"></Icon>
        </div>
      </button>
    {/if}
  </div>
</div>

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
    flex-direction: column;

    padding: 4px;
    pointer-events: all;
    width: max-content;
    height: 28px;
    box-sizing: border-box;
    overflow: visible;

    z-index: 10;

    gap: 8px;
  }
  .icon {
    width: 24px;
  }
  button {
    display: flex;
    flex-direction: row;
    padding: 4px;
    border-radius: 8px;
    display: flex;
    flex-direction: row;
    justify-content: center;
  }
</style>
