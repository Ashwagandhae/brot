<script lang="ts">
  import { getNote, setNote } from "$lib/message";
  import { onDestroy, onMount, tick, untrack } from "svelte";
  import Editor from "$lib/EditorTipTap.svelte";
  import type { Note } from "../../src-tauri/bindings/Note";
  import TextBar from "./TextBar.svelte";
  import type { NoteActionRegistry } from "./command";

  let {
    path,
    registry = $bindable(),
    onfocus,
    focused,
  }: {
    path: string;
    registry: NoteActionRegistry;
    onfocus?: () => void;
    focused: boolean;
  } = $props();

  let note: Note | null = $state(null);
  let initContent: string | null = $state(null);
  let getContent: () => string = $state(() => "");
  let setContent: (markdown: string) => void = $state(() => {});

  onMount(async () => {
    note = await getNote(path);
    initContent = note.content;
  });

  async function saveNote() {
    if (note == null) return;
    note.content = getContent();
    await setNote(path, note);
  }

  let saved = $state(true);
  let interval = setInterval(async () => {
    if (note == null) return;
    if (!saved) {
      saveNote();
    }
    saved = true;
  }, 2000);
  onDestroy(() => {
    clearInterval(interval);
  });

  function handleEditorUpdate() {
    saved = false;
  }

  let editingTitle = $state(false);

  let editedTitle = $state("");
  let editTitleTextBarElement: HTMLElement | undefined = $state(undefined);

  function updateTitle() {
    if (note == null) return;
    editingTitle = false;
    if (editedTitle == "") return;
    if (editedTitle == note.meta.title) return;
    note.meta.title = editedTitle;
    saveNote();
  }

  registry.editTitle = () => startEditing();
  registry.currentTitle = () => note?.meta.title ?? null;
  registry.toggleMinimized = () => (minimized = !minimized);
  registry.save = () => {
    let content = getContent();
    setContent(content);
    saveNote();
  };

  async function startEditing() {
    editingTitle = true;
    if (note == null) return;
    editedTitle = note.meta.title;
    await tick();
    editTitleTextBarElement!.focus();
  }
  let minimized = $state(false);
</script>

<div class="top">
  <div class="topBar">
    {#if editingTitle && note != null}
      <div class="titleText">
        <TextBar
          bind:value={editedTitle}
          onaccept={updateTitle}
          oncancel={() => (editingTitle = false)}
          {onfocus}
          bind:element={editTitleTextBarElement}
          placeholder={"title"}
        ></TextBar>
      </div>
    {:else}
      <button
        class="title"
        disabled={note == null}
        onclick={startEditing}
        class:toggled={focused}
      >
        {#if note == null}no note{:else}{note.meta.title}{#if !saved}*{/if}{/if}
      </button>
    {/if}
    <div class="tools">
      <button
        class="minimize hidden"
        aria-label="minimize"
        onclick={() => (minimized = !minimized)}
        >{#if minimized}∧{:else}∨{/if}</button
      >
    </div>
  </div>

  {#if !minimized}
    <div class="content">
      {#if note == null || initContent == null}
        <p>no note found</p>
      {:else}
        <Editor
          {initContent}
          bind:getContent
          bind:setContent
          {onfocus}
          onupdate={handleEditorUpdate}
        ></Editor>
      {/if}
    </div>
  {/if}
</div>

<style>
  .top {
    display: flex;
    flex-direction: column;
    width: 100%;
    align-items: center;
  }

  .content {
    padding: 8px;
    overflow: scroll;
    position: relative;
    box-sizing: border-box;
    width: 100%;
  }
  .topBar {
    top: 0;
    position: sticky;

    display: flex;
    flex-direction: row;

    padding: 4px;
    pointer-events: all;
    width: 100%;
    height: 28px;
    box-sizing: border-box;
    overflow: visible;

    justify-content: center;

    z-index: 10;

    /* align-items: center; */
    gap: 4px;
  }

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

  button.minimize {
    height: 20px;
    width: 20px;

    font-size: 1rem;
    border-radius: 50%;
    pointer-events: all;
  }
  .tools {
    position: absolute;
    right: 4px;
    top: 0;
  }
</style>
