<script lang="ts">
  import "./editor.css";
  import { onMount } from "svelte";
  import { openUrl } from "@tauri-apps/plugin-opener";

  import { Editor } from "@tiptap/core";
  import { readText } from "@tauri-apps/plugin-clipboard-manager";

  import { ArgsFilter, type ActionRegistryManager } from "./actions";
  import { isTauri } from "./platform";

  import { addEditorActions } from "./editorAction";
  import {
    parseLangFromString,
    parseLatexRenderFromString,
    parseUrlFromString,
    type LatexRender,
  } from "./parse";
  import { getComponentPaletteContext } from "./componentPalette";
  import CheckerEdit from "./CheckerEdit.svelte";
  import TextChecker from "./TextChecker.svelte";
  import { withProps } from "./componentProps";
  import LatexOutputDisplay from "./LatexOutputDisplay.svelte";
  import { initExtensions } from "./editorInit";

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

  let editor: Editor | null = null;
  let element: HTMLElement;

  let componentPaletteContext = getComponentPaletteContext();

  function initRegistry(editor: Editor) {
    registry.add(
      {
        getEditor: () => editor,
        pasteWithoutFormatting: () => {
          if (isTauri()) {
            readText().then((val) => {
              editor.commands.insertContent(val);
            });
          }
        },
        copySelectionMd: () => {
          let node = getSelectionNode(editor);
          if (node == null) return;
          navigator.clipboard.writeText(
            editor.markdown!.renderNodeToMarkdown(node.toJSON())
          );
        },
        editLink: () => {
          componentPaletteContext()(
            withProps(CheckerEdit<URL, string>, {
              checker: withProps(TextChecker<URL>, {}),
              init: editor.getAttributes("link")?.href ?? "",
              setVal: (url: URL) => {
                if (url != null) {
                  editor
                    .chain()
                    .focus()
                    .extendMarkRange("link")
                    .setLink({ href: url.toString() })
                    .run();
                }
              },
              toVal: parseUrlFromString,
            })
          );
        },
        editCodeBlockLang: () => {
          componentPaletteContext()(
            withProps(CheckerEdit<string, string>, {
              checker: withProps(TextChecker<string>, {}),
              init: editor.getAttributes("codeBlock").language,
              setVal: (language: string) => {
                editor
                  .chain()
                  .focus()
                  .updateAttributes("codeBlock", { language })
                  .run();
              },
              toVal: parseLangFromString,
            })
          );
        },
        setSpellCheck: () => {
          editor.view.dom.setAttribute("spellcheck", "true");
        },
        unsetSpellCheck: () => {
          editor.view.dom.setAttribute("spellcheck", "false");
        },
        openLink: () => {
          let href = editor.getAttributes("link")?.href;
          if (href == null) return;
          if (isTauri()) {
            openUrl(href);
          } else {
            let newTab = window.open(href, "_blank");
            newTab?.focus();
          }
        },
      },
      {
        editLink: () => ArgsFilter.fromBool(editor.isActive("link")),
        editCodeBlockLang: () =>
          ArgsFilter.fromBool(editor.isActive("codeBlock")),
      }
    );

    addEditorActions(registry, editor, {
      unsetAllMarks: () => (chain) => chain.unsetAllMarks().run(),
      clearFormatting: () => (chain) =>
        chain.clearNodes().unsetAllMarks().run(),
      clearNodes: () => (chain) => chain.clearNodes().run(),
      // hard break
      setHardBreak: () => (chain) => chain.setHardBreak().run(),
      // list
      toggleBulletList: () => (chain) => chain.toggleBulletList().run(),
      toggleOrderedList: () => (chain) => chain.toggleOrderedList().run(),
      splitListItem: () => (chain) => chain.splitListItem("listItem").run(),
      sinkListItem: () => (chain) => chain.sinkListItem("listItem").run(),
      liftListItem: () => (chain) => chain.liftListItem("listItem").run(),
      // link
      setLink: (url?: URL) => (chain) =>
        chain
          .extendMarkRange("link")
          .setLink({ href: url?.toString() ?? "" })
          .run(),
      unsetLink: () => (chain) =>
        chain.extendMarkRange("link").unsetLink().run(),
      // table
      insertTable: () => (chain) =>
        chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      addColumnBefore: () => (chain) => chain.addColumnBefore().run(),
      addColumnAfter: () => (chain) => chain.addColumnAfter().run(),
      deleteColumn: () => (chain) => chain.deleteColumn().run(),
      addRowBefore: () => (chain) => chain.addRowBefore().run(),
      addRowAfter: () => (chain) => chain.addRowAfter().run(),
      deleteRow: () => (chain) => chain.deleteRow().run(),
      deleteTable: () => (chain) => chain.deleteTable().run(),
      mergeCells: () => (chain) => chain.mergeCells().run(),
      splitCell: () => (chain) => chain.splitCell().run(),
      toggleHeaderColumn: () => (chain) => chain.toggleHeaderColumn().run(),
      toggleHeaderRow: () => (chain) => chain.toggleHeaderRow().run(),
      toggleHeaderCell: () => (chain) => chain.toggleHeaderCell().run(),
      mergeOrSplit: () => (chain) => chain.mergeOrSplit().run(),
      // blockquote
      toggleBlockquote: () => (chain) => chain.toggleBlockquote().run(),
      setBlockquote: () => (chain) => chain.setBlockquote().run(),
      unsetBlockquote: () => (chain) => chain.unsetBlockquote().run(),
      // heading
      setHeading: (level) => (chain) =>
        chain.setHeading({ level: level ?? 1 }).run(),
      toggleHeading: (level) => (chain) =>
        chain.toggleHeading({ level: level ?? 1 }).run(),
      // paragraph
      setParagraph: () => (chain) => chain.setParagraph().run(),
      // bold
      setBold: () => (chain) => chain.setBold().run(),
      unsetBold: () => (chain) => chain.unsetBold().run(),
      toggleBold: () => (chain) => chain.toggleBold().run(),
      // code
      setCode: () => (chain) => chain.setCode().run(),
      unsetCode: () => (chain) => chain.unsetCode().run(),
      toggleCode: () => (chain) => chain.toggleCode().run(),
      // italic
      setItalic: () => (chain) => chain.setItalic().run(),
      unsetItalic: () => (chain) => chain.unsetItalic().run(),
      toggleItalic: () => (chain) => chain.toggleItalic().run(),
      // strike
      setStrike: () => (chain) => chain.setStrike().run(),
      unsetStrike: () => (chain) => chain.unsetStrike().run(),
      toggleStrike: () => (chain) => chain.toggleStrike().run(),
      // underline
      setUnderline: () => (chain) => chain.setUnderline().run(),
      unsetUnderline: () => (chain) => chain.unsetUnderline().run(),
      toggleUnderline: () => (chain) => chain.toggleUnderline().run(),
      // undo redo
      undo: () => (chain) => chain.undo().run(),
      redo: () => (chain) => chain.redo().run(),
      // details
      setDetails: () => (chain) => chain.setDetails().run(),
      unsetDetails: () => (chain) => chain.unsetDetails().run(),
      // codeblock
      setCodeBlock: () => (chain) => chain.setCodeBlock().run(),
      toggleCodeBlock: () => (chain) => chain.toggleCodeBlock().run(),
      // math
    });
  }

  getContent = () => {
    return editor!.getMarkdown();
  };

  setContent = (markdown: string) => {
    if (editor == null) return;
    const { from, to } = editor.state.selection;
    editor.commands.setContent(markdown, { contentType: "markdown" });
    editor.commands.setTextSelection({ from, to });
  };

  onMount(() => {
    let extensions = initExtensions();
    editor = new Editor({
      element: element,
      extensions,
      content: initContent,
      contentType: "markdown",
      onUpdate: () => {
        onupdate?.();
      },
      onFocus: () => {
        onfocus?.();
      },
      onSelectionUpdate: () => {
        onselectionchange?.();
      },
      onCreate: ({ editor }) => {
        editor.view.dom.setAttribute("spellcheck", "false");
        editor.view.dom.setAttribute("autocapitalize", "off");
      },
    });
    initRegistry(editor);
  });

  function getSelectionNode(editor: Editor) {
    const { state } = editor;
    const { selection, doc } = state;

    if (selection.empty) {
      return null;
    }

    const slice = doc.cut(selection.from, selection.to);
    return slice;
  }
</script>

<div id="editor" bind:this={element}></div>

<style>
  :global(:focus) {
    outline: none;
  }
</style>
