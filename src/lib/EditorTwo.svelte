<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { isTauri } from "./platform";

  import { type ActionRegistryManager } from "./actions";

  import { EditorView } from "codemirror";
  import { typstishLivePreview } from "./editor";

  let {
    initContent,
    getContent = $bindable(),
    setContent = $bindable(),
    registry = $bindable(),
    onupdate,
    onfocus,
    onselectionchange,
  }: {
    initContent: string;
    getContent: () => string;
    setContent: (markdown: string) => void;
    registry: ActionRegistryManager;
    onupdate?: () => void;
    onfocus?: () => void;
    onselectionchange?: () => void;
  } = $props();

  let view: EditorView | null = null;
  let viewPromise: Promise<EditorView> | null = null;
  let element: HTMLElement;

  getContent = () => {
    return view!.state.doc.toString();
  };

  setContent = (markdown: string) => {
    if (view == null) return;
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: markdown,
      },
    });
  };
  function initRegistry(editor: Promise<EditorView>) {
    registry.add({
      getEditor: () => editor,
    });
  }
  onMount(() => {
    viewPromise = (async () => {
      view = new EditorView({
        doc: initContent,
        extensions: [
          await typstishLivePreview({
            helix: true,
            linkHandler: (url) => {
              if (isTauri()) {
                openUrl(url);
              } else {
                let newTab = window.open(url, "_blank");
                newTab?.focus();
              }
            },
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onupdate?.();
            }
            if (update.focusChanged && update.view.hasFocus) {
              onfocus?.();
            }
            if (update.selectionSet) {
              onselectionchange?.();
            }
          }),
          EditorView.cursorScrollMargin.of({
            x: 0,
            y: 100,
          }),
        ],
        parent: element,
      });
      return view;
    })();
    initRegistry(viewPromise);
  });
  onDestroy(() => {
    view?.destroy();
  });
</script>

<div id="view" bind:this={element}></div>

<style>
  :global(:focus) {
    outline: none;
  }
</style>
