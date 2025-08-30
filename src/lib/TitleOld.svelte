<script lang="ts">
  import TextBar from "./TextBar.svelte";
  import { msg } from "./message";
  import { getPathContext, pathToTitleString } from "./path";

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
    console.log("editing title");
    editingTitle = true;
    editedTitle = pathToTitleString(path);
  };

  async function updateTitle() {
    editingTitle = false;
    // focusNote();
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
      oncancel={() => {
        console.log("cancel editing title");
        editingTitle = false;
      }}
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
    {#if !noteExists}no note{:else}{pathToTitleString(
        path
      )}{#if !saved}*{/if}{/if}
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
    color: var(--text-strong);
    border: none;
  }
</style>
