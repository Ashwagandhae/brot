<script lang="ts">
  import "./editor.css";
  import { onMount, type Component, type ComponentProps } from "svelte";
  import { TableKit } from "@tiptap/extension-table";
  import { Editor } from "@tiptap/core";
  import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
  import { readText } from "@tauri-apps/plugin-clipboard-manager";

  import Link from "@tiptap/extension-link";

  import { all, createLowlight } from "lowlight";

  import { HTMLarkdown } from "htmlarkdown";
  import "katex/dist/katex.min.css";
  import { Marked } from "marked";
  import { markedHighlight } from "marked-highlight";
  import { IndentHandler } from "./editorTabExtension";
  import { ArgsFilter, type ActionRegistryManager } from "./actions";
  import { isTauri } from "./platform";

  // nodes
  import Blockquote from "@tiptap/extension-blockquote";
  import { BulletList } from "@tiptap/extension-list";
  import Document from "@tiptap/extension-document";
  import HardBreak from "@tiptap/extension-hard-break";
  import Heading from "@tiptap/extension-heading";
  import HorizontalRule from "@tiptap/extension-horizontal-rule";
  import { ListItem } from "@tiptap/extension-list";
  import { OrderedList } from "@tiptap/extension-list";
  import Paragraph from "@tiptap/extension-paragraph";
  import Text from "@tiptap/extension-text";
  import {
    Details,
    DetailsContent,
    DetailsSummary,
  } from "@tiptap/extension-details";
  import Bold from "@tiptap/extension-bold";
  import Code from "@tiptap/extension-code";
  import Italic from "@tiptap/extension-italic";
  import Strike from "@tiptap/extension-strike";
  import Underline from "@tiptap/extension-underline";
  // extensions
  import { Dropcursor } from "@tiptap/extensions";
  import { Gapcursor } from "@tiptap/extensions";
  import { UndoRedo } from "@tiptap/extensions";
  import { addEditorActions } from "./editorAction";
  import TextIo from "./TextChecker.svelte";
  import { parseUrlFromString } from "./parse";
  import { getComponentPaletteContext } from "./componentPalette";
  import { htmlToMarkdown, markdownToHtml } from "./markdown";
  import CheckerEdit from "./CheckerEdit.svelte";
  import TextChecker from "./TextChecker.svelte";
  import { asClassComponent } from "svelte/legacy";
  import Palette from "./Palette.svelte";
  import BoldChars from "./BoldChars.svelte";

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
  let lowlight = createLowlight(all);

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
        editLink: () => {
          let initText: string = editor.getAttributes("link")?.href ?? "";
          let openComponentPalette = componentPaletteContext();
          openComponentPalette(CheckerEdit<URL, string>, {
            Checker: TextChecker<URL>,
            init: initText,
            setVal: (url: URL) => {
              if (url != null) {
                editor.chain().focus().setLink({ href: url.toString() }).run();
              }
            },
            toVal: parseUrlFromString,
          });
        },
      },
      {
        editLink: () => ArgsFilter.fromBool(editor.isActive("link")),
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
        chain.insertTable({ rows: 3, cols: 3, withHeaderRow: false }).run(),
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
      setHorizontalRule: () => (chain) => chain.setHorizontalRule().run(),
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
    });
  }

  getContent = () => {
    return htmlToMarkdown(editor!.getHTML());
  };

  setContent = (markdown: string) => {
    if (editor == null) return;
    const { from, to } = editor.state.selection;
    editor.commands.setContent(markdownToHtml(markdown));
    editor.commands.setTextSelection({ from, to });
  };

  onMount(() => {
    editor = new Editor({
      element: element,
      extensions: [
        // starterkit:
        HardBreak.extend({ addKeyboardShortcuts: () => ({}) }),
        Blockquote.extend({ addKeyboardShortcuts: () => ({}) }),
        BulletList.extend({ addKeyboardShortcuts: () => ({}) }),
        Document,
        Heading.extend({ addKeyboardShortcuts: () => ({}) }),
        HorizontalRule,
        ListItem,
        OrderedList,
        Paragraph.extend({ addKeyboardShortcuts: () => ({}) }),
        Text,
        Bold.extend({ addKeyboardShortcuts: () => ({}) }),
        Code.extend({ addKeyboardShortcuts: () => ({}) }),
        Italic.extend({ addKeyboardShortcuts: () => ({}) }),
        Strike.extend({ addKeyboardShortcuts: () => ({}) }),
        Underline.extend({ addKeyboardShortcuts: () => ({}) }),
        Dropcursor,
        Gapcursor,
        UndoRedo.extend({ addKeyboardShortcuts: () => ({}) }),
        // starterkit end

        TableKit.configure({ table: { resizable: true } }),
        CodeBlockLowlight.configure({
          lowlight,
        }),
        Link.configure({
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          protocols: ["http", "https"],
        }),
        IndentHandler,
        Details.configure({
          persist: true,
          HTMLAttributes: {
            class: "details",
          },
        }),
        DetailsSummary,
        DetailsContent,
      ],
      content: markdownToHtml(initContent),
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
        editor.view.dom.setAttribute("autocomplete", "off");
        editor.view.dom.setAttribute("autocapitalize", "off");
      },
    });
    initRegistry(editor);
  });
</script>

<div id="editor" bind:this={element}></div>

<style>
  :global(:focus) {
    outline: none;
  }
</style>
