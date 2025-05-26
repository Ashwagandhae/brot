<script lang="ts">
  import { onMount } from "svelte";
  import type { Note } from "../../src-tauri/bindings/Note";
  import { Crepe } from "@milkdown/crepe";
  import "@milkdown/crepe/theme/common/style.css";
  import "@milkdown/crepe/theme/nord-dark.css";
  import "./editor.css";
  import { getMarkdown } from "@milkdown/kit/utils";

  let {
    content = $bindable(),
    onfocus,
  }: { content: string; onfocus?: () => void } = $props();

  let editorElement: HTMLElement;

  onMount(() => {
    const crepe = new Crepe({
      root: editorElement,
      defaultValue: content,
      features: {
        // [Crepe.Feature.BlockEdit]: false,
      },
      featureConfigs: {
        [Crepe.Feature.Placeholder]: {
          text: "", // Set to empty string to remove
        },
      },
    });
    crepe.create().then(() => {});
    crepe.on((listener) => {
      listener.markdownUpdated((ctx) => {
        content = getMarkdown()(ctx);
      });
      listener.focus((ctx) => {
        onfocus?.();
      });
    });
    return crepe.destroy;
  });

  // function editor(dom: HTMLElement) {
  //   // to obtain the editor instance we need to store a reference of the editor.
  //   const MakeEditor = Editor.make()
  //     .config((ctx) => {
  //       ctx.set(rootCtx, dom);
  //     })
  //     .use(commonmark)
  //     .use(gfm)
  //     .use(history)
  //     .use(clipboard)
  //     .use(cursor)
  //     .use(listener)
  //     .use(indent)
  //     .use(math)
  //     .create();

  //   MakeEditor.then((editor) => {
  //     editor.action(replaceAll(note.content));
  //   });
  // }
</script>

<div id="editor" bind:this={editorElement}></div>

<style>
  :global(:focus) {
    outline: none;
  }
</style>
