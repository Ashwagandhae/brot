<script lang="ts">
  import { getNote, setNote } from "$lib/message";
  import { onDestroy, onMount, tick } from "svelte";
  import Editor from "$lib/EditorMilkdown.svelte";
  import type { Note } from "../../src-tauri/bindings/Note";
  import TextBar from "./TextBar.svelte";

  let {
    path,
    editTitle = $bindable(),
    currentTitle = $bindable(),
    onfocus,
  }: {
    path: string;
    editTitle?: () => void;
    currentTitle?: () => string | null;
    onfocus?: () => void;
  } = $props();

  let note: Note | null = $state(null);
  let content: string = $state("");

  onMount(async () => {
    note = await getNote(path);
    content = note.content;
  });

  async function saveNote() {
    if (note == null) return;
    await setNote(path, note);
  }

  let saved = $state(true);
  let interval = setInterval(async () => {
    if (note == null) return;
    if (!saved) {
      saveNote();
    }
    saved = true;
  }, 3000);

  $effect(() => {
    if (note != null) {
      note.content = content;
      saved = false;
    }
  });

  onDestroy(() => {
    clearInterval(interval);
  });

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

  editTitle = () => startEditing();
  currentTitle = () => note?.meta.title ?? null;

  async function startEditing() {
    editingTitle = true;
    if (note == null) return;
    editedTitle = note.meta.title;
    await tick();
    editTitleTextBarElement!.focus();
  }
</script>

<div class="top">
  <div class="titleBar">
    {#if editingTitle && note != null}
      <TextBar
        bind:value={editedTitle}
        onaccept={updateTitle}
        oncancel={() => (editingTitle = false)}
        {onfocus}
        bind:element={editTitleTextBarElement}
        placeholder={"title"}
      ></TextBar>
    {:else}
      <button class="title" disabled={note == null} onclick={startEditing}>
        {#if note == null}no note{:else}{note.meta.title}{#if !saved}*{/if}{/if}
      </button>
    {/if}
  </div>

  <div class="content">
    {#if note == null}
      <p>no note found</p>
    {:else}
      <Editor bind:content {onfocus}></Editor>
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

  .content {
    padding: 8px;
    overflow: scroll;
    position: relative;
    box-sizing: border-box;
    width: 100%;
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
