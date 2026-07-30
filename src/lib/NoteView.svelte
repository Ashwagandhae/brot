<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import type { Note } from "../../src-tauri/bindings/Note";

  import Editor from "./EditorTwo.svelte";
  import { EditorSelection } from "@codemirror/state";
  import type { ActionRegistryManager } from "./actions";
  import { platform } from "./platform";
  import Title from "./Title.svelte";
  import { getPathContext, pathToTitleString, pathToUrl } from "./path";
  import Icon from "./Icon.svelte";
  import { msg } from "./message";
  import { getComponentPaletteContext } from "./componentPalette";
  import { withProps } from "./componentProps";
  import CheckerEdit from "./CheckerEdit.svelte";
  import TextChecker from "./TextChecker.svelte";
  import { parseTitleFromString } from "./parse";
  import TitleOutputDisplay from "./TitleOutputDisplay.svelte";
  import { TagSuggestionProvider } from "./suggestion";
  let {
    path,
    registry = $bindable(),
    onfocus,
    focused,
    autofocus,
    canMinimize,
    minimized = $bindable(false),
  }: {
    path: string;
    registry: ActionRegistryManager;
    onfocus?: () => void;
    focused: boolean;
    autofocus?: boolean;
    canMinimize?: boolean;
    minimized?: boolean;
  } = $props();

  let note: Note | null = $state(null);
  let initContent: string | null = $state(null);
  let getContent: () => string = $state(() => "");
  let setContent: (markdown: string) => void = $state(() => {});

  let componentPaletteContext = getComponentPaletteContext();
  let pathContext = getPathContext();

  const defaultEditorFontSize = 16;
  let editorFontSize: number = $state(defaultEditorFontSize);
  onMount(() => {
    registry.add({
      editNoteTitle: () => {
        editTitle();
      },
      getNoteTitle: () => pathToTitleString(path),
      toggleNoteMinimized: () => toggleMinimize(),
      saveNote: async () => {
        let content = getContent();
        let { format } = await import("@typstyle/typstyle-wasm-bundler");
        let formattedContent = format(content, {});
        formattedContent = formattedContent.trimEnd();
        setContent(formattedContent);
        await saveNote();
        saved = true;
      },
      focusScrollNote: () => focusNote(true),
      focusNote: () => focusNote(false),
      focusNoteEnd: async () => {
        const view = await registry.get("getEditor")?.();
        if (view == null) return;
        view.focus();
      },
      copyUrl: () => {
        navigator.clipboard.writeText(pathToUrl(path));
      },
      increaseEditorFontSize() {
        editorFontSize = Math.round(editorFontSize * 1.25);
      },

      reduceEditorFontSize() {
        editorFontSize = Math.round(editorFontSize * 0.8);
      },

      resetEditorFontSize() {
        editorFontSize = defaultEditorFontSize;
      },
    });
  });

  onMount(async () => {
    note = await msg("getNote", { path });
    if (note != null) {
      initContent = note.content;
      await tick();
      if (autofocus) {
        focusNote(false);
      }
    }
  });

  async function saveNote() {
    if (note == null) return;
    note.content = getContent();
    await msg("updateNote", { path, note });
  }

  let saved = $state(true);
  let interval = setInterval(async () => {
    if (note == null) return;
    if (!saved) {
      await saveNote();
    }
    saved = true;
  }, 1000);
  onDestroy(() => {
    clearInterval(interval);
  });

  function handleUpdate() {
    saved = false;
  }

  async function handleSelectionChange() {
    if (note == null) return;
    let editor = await registry.get("getEditor")?.();
    if (editor == null) return;
    let selection = editor.state.selection;
    if (selection == null) return;
    note.meta.selection = [selection.main.from, selection.main.to];
  }

  function editTitle() {
    componentPaletteContext()(
      withProps(CheckerEdit<string, string>, {
        checker: withProps(TextChecker<string>, {
          suggestionProvider: new TagSuggestionProvider(),
        }),
        init: pathToTitleString(path),
        setVal: async (newTitle: string) => {
          let newPath = await msg("updatePath", {
            currentPath: path,
            newTitle,
          });
          if (newPath != null) {
            pathContext.setPath(path, newPath);
          }
        },
        toVal: parseTitleFromString,
        outputDisplay: withProps(TitleOutputDisplay, {}),
      }),
    );
  }

  async function focusNote(scroll: boolean) {
    console.log("focusing note");
    let [from, to] = note?.meta.selection ?? [0, 0];
    let editor = await registry.get("getEditor")?.();
    if (editor != null) {
      editor.focus();
      editor.dispatch({
        selection: EditorSelection.range(from, to),
        scrollIntoView: true,
      });
    }

    if (scroll) {
      element?.scrollIntoView();
    }
  }

  $effect(() => {
    if (!focused) {
      (async () => {
        let editor = await registry.get("getEditor")?.();
        editor?.contentDOM.blur();
      })();
    }
  });

  let lastMinimized = false;
  $effect(() => {
    if (!minimized && lastMinimized && focused) {
      setTimeout(() => {
        // need to set timeout because editorview is created async
        focusNote(false);
      }, 0);
    }
    lastMinimized = minimized;
  });

  function toggleMinimize() {
    if (!minimized) {
      initContent = getContent();
    }
    minimized = !minimized;
  }

  let element: HTMLElement | null = $state(null);
</script>

<div
  class="top"
  bind:this={element}
  class:focused
  style="--font-size: {editorFontSize}px"
>
  <div class="topBar" class:window={$platform == "window"}>
    <button class="titleBack" onclick={editTitle}>
      <Title {path} level={2}></Title>
    </button>
    <div class="tools">
      {#if canMinimize}
        <button
          class="minimize hidden"
          aria-label="minimize"
          onclick={toggleMinimize}
        >
          {#if minimized}
            <Icon name="triangleDown"></Icon>
          {:else}
            <Icon name="triangleUp"></Icon>
          {/if}
        </button>
      {/if}
    </div>
  </div>

  {#if !minimized || !canMinimize}
    <div class="content">
      {#if note == null || initContent == null}
        <p>no note found</p>
      {:else}
        <Editor
          {initContent}
          bind:getContent
          bind:setContent
          bind:registry
          {onfocus}
          onupdate={handleUpdate}
          onselectionchange={handleSelectionChange}
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
    padding-left: 8px;
    padding-right: 8px;
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

    /* padding: 4px; */
    pointer-events: none;
    width: 100%;
    height: 28px;
    box-sizing: border-box;
    overflow: visible;

    /* justify-content: center; */

    z-index: 10;

    align-items: center;
    gap: 4px;
    padding: 0 3px;
  }

  .topBar > :global(*) {
    pointer-events: all;
  }

  .titleBack {
    flex: 1;
    overflow: scroll;
    background: none;
    color: var(--text-weak);
  }
  .focused .titleBack {
    color: var(--text);
  }
  .titleBack::-webkit-scrollbar {
    display: none; /* Safari & Chrome */
  }

  button.minimize {
    height: 20px;
    width: 20px;

    display: flex;
    align-items: center;
    justify-content: center;

    font-size: 1rem;
    border-radius: 50%;
    pointer-events: all;
    padding: 5px;
  }
  .tools {
    position: absolute;
    right: 4px;
    top: 4px;
  }
</style>
