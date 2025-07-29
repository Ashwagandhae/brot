<script lang="ts">
  import { getNote, setNote } from "$lib/message";
  import { onDestroy, onMount, tick } from "svelte";
  import type { Note } from "../../src-tauri/bindings/Note";

  import EditorTipTap from "./EditorTipTap.svelte";
  import type { ActionRegistry } from "./actions";
  import { platform } from "./platform";
  import Title from "./Title.svelte";
  import { pathToTitle, pathToUrl } from "./path";

  let {
    path,
    registry = $bindable(),
    onfocus,
    focused,
    autofocus,
  }: {
    path: string;
    registry: ActionRegistry;
    onfocus?: () => void;
    focused: boolean;
    autofocus?: boolean;
  } = $props();

  let note: Note | null = $state(null);
  let initContent: string | null = $state(null);
  let getContent: () => string = $state(() => "");
  let setContent: (markdown: string) => void = $state(() => {});

  onMount(async () => {
    note = await getNote(path);
    if (note != null) {
      initContent = note.content;
      await tick();
      if (autofocus) {
        focusNote();
      }
    }
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
      await saveNote();
    }
    saved = true;
  }, 2000);
  onDestroy(() => {
    clearInterval(interval);
  });

  function handleEditorUpdate() {
    saved = false;
  }

  let startEditing = $state(() => {});

  registry.editNoteTitle = () => startEditing();
  registry.getNoteTitle = () => pathToTitle(path);
  registry.toggleNoteMinimized = () => (minimized = !minimized);
  registry.saveNote = async () => {
    let content = getContent();
    setContent(content);
    await saveNote();
    saved = true;
  };
  registry.focusNote = () => focusNote();
  registry.copyUrl = () => {
    navigator.clipboard.writeText(pathToUrl(path));
  };

  let minimized = $state(false);

  function focusNote() {
    let [from, to] = note?.meta.selection ?? [0, 0];
    registry
      .getEditor?.()
      ?.chain()
      .focus(null, { scrollIntoView: false })
      .setTextSelection({ from, to })
      .run();
    element?.scrollIntoView();
  }

  let element: HTMLElement | null = $state(null);
</script>

<div class="top" bind:this={element}>
  <div class="topBar" class:window={$platform == "window"}>
    <Title
      noteExists={note != null}
      {saved}
      {path}
      {onfocus}
      {focused}
      {focusNote}
      bind:startEditing
    />
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
        <EditorTipTap
          {initContent}
          bind:getContent
          bind:setContent
          bind:registry
          {onfocus}
          onupdate={handleEditorUpdate}
        ></EditorTipTap>
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
    pointer-events: none;
    width: 100%;
    height: 28px;
    box-sizing: border-box;
    overflow: visible;

    /* justify-content: center; */

    z-index: 10;

    /* align-items: center; */
    gap: 4px;
  }

  .topBar > :global(*) {
    pointer-events: all;
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
