<script lang="ts">
  import { goto } from "$app/navigation";
  import TextBar from "./TextBar.svelte";
  import { msg } from "./message";
  import { getPathContext, pathToTitle } from "./path";

  let pathContext = getPathContext();

  let {
    noteExists,
    saved,
    path,
    onfocus,
    focusNote,
    focused,
    startEditing = $bindable(),
  }: {
    noteExists: boolean;
    saved: boolean;
    path: string;
    onfocus?: () => void;
    focused: boolean;
    focusNote: () => void;
    startEditing: () => void;
  } = $props();

  let editingTitle = $state(false);
  let editedTitle = $state("");

  startEditing = () => {
    editingTitle = true;
    editedTitle = pathToTitle(path);
  };

  async function updateTitle() {
    editingTitle = false;
    focusNote();
    let newPath = await msg("updatePath", {
      currentPath: path,
      newTitle: editedTitle,
    });
    if (newPath != null) {
      pathContext.setPath(path, newPath);
    }
  }
</script>

{#if editingTitle && noteExists}
  <div class="titleText">
    <TextBar
      bind:value={editedTitle}
      onaccept={updateTitle}
      oncancel={() => (editingTitle = false)}
      {onfocus}
      autofocus
      placeholder={"title"}
    ></TextBar>
  </div>
{:else}
  <button
    class="title"
    disabled={!noteExists}
    onclick={startEditing}
    class:toggled={focused}
  >
    {#if !noteExists}no note{:else}{pathToTitle(path)}{#if !saved}*{/if}{/if}
  </button>
{/if}

<style>
  .titleText {
    width: 180px;
  }
  button.title {
    width: auto;
    height: 20px;
    box-sizing: border-box;
    padding: 0 10px;
    border-radius: 10px 10px;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    line-height: 20px;
    color: var(--text);
    border: none;
  }
</style>
