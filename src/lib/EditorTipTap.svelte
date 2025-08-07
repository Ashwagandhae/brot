<script lang="ts">
  import "./editorTipTap.css";
  import { onMount } from "svelte";
  import StarterKit from "@tiptap/starter-kit";
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
  import type { ActionRegistryManager } from "./actions";
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
  // marks
  import Bold from "@tiptap/extension-bold";
  import Code from "@tiptap/extension-code";
  import Italic from "@tiptap/extension-italic";
  import Strike from "@tiptap/extension-strike";
  import Underline from "@tiptap/extension-underline";
  // extensions
  import { Dropcursor } from "@tiptap/extensions";
  import { Gapcursor } from "@tiptap/extensions";
  import { UndoRedo } from "@tiptap/extensions";
  import { ListKeymap } from "@tiptap/extension-list";
  import { addEditorActions } from "./editorAction";

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
  let myMarked = new Marked(
    markedHighlight({
      emptyLangClass: "",
      langPrefix: "language-",
      highlight(code, lang, info) {
        return code;
      },
    })
  );

  function initRegistry(editor: Editor) {
    registry.add({
      editorToggleBold: () => {
        editor.chain().focus().toggleBold().run();
      },
      getEditor: () => editor,
      pasteWithoutFormatting: () => {
        if (isTauri()) {
          readText().then((val) => {
            editor.commands.insertContent(val);
          });
        }
      },
    });
    addEditorActions(registry, editor, {
      setLink: (url?: string) => (chain) =>
        chain
          .focus()
          .extendMarkRange("link")
          .setLink({ href: url ?? "" })
          .run(),
      unsetLink: () => (chain) =>
        chain.focus().extendMarkRange("link").unsetLink().run(),
      insertTable: () => (chain) =>
        chain
          .focus()
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run(),
      addColumnBefore: () => (chain) => chain.focus().addColumnBefore().run(),
      addColumnAfter: () => (chain) => chain.focus().addColumnAfter().run(),
      deleteColumn: () => (chain) => chain.focus().deleteColumn().run(),
      addRowBefore: () => (chain) => chain.focus().addRowBefore().run(),
      addRowAfter: () => (chain) => chain.focus().addRowAfter().run(),
      deleteRow: () => (chain) => chain.focus().deleteRow().run(),
      deleteTable: () => (chain) => chain.focus().deleteTable().run(),
      mergeCells: () => (chain) => chain.focus().mergeCells().run(),
      splitCell: () => (chain) => chain.focus().splitCell().run(),
      toggleHeaderColumn: () => (chain) =>
        chain.focus().toggleHeaderColumn().run(),
      toggleHeaderRow: () => (chain) => chain.focus().toggleHeaderRow().run(),
      toggleHeaderCell: () => (chain) => chain.focus().toggleHeaderCell().run(),
      mergeOrSplit: () => (chain) => chain.focus().mergeOrSplit().run(),
    });
  }

  let markdown = new HTMLarkdown({
    codeblockTrailingLinebreak: "add",
    addTrailingLinebreak: false,
  });
  markdown.addRule({
    filter: ["span"],
    replacement: (element) => {
      return element.outerHTML;
    },
  });

  markdown.addRule({
    filter: ["pre"],
    replacement: (element) => {
      let lang = Array.from(element.querySelector("code")?.classList!)
        .find((s) => s.startsWith("language-"))
        ?.substring("language-".length);
      return "```" + lang + "\n" + element.textContent?.trim() + "\n```\n";
    },
  });

  function htmlToMarkdown(html: string) {
    let md = markdown.convert(html);
    return md;
  }

  function markdownToHtml(md: string) {
    let html = myMarked.parse(md);
    return html;
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
        Blockquote,
        BulletList,
        Document,
        HardBreak,
        Heading,
        HorizontalRule,
        ListItem,
        OrderedList,
        Paragraph,
        Text,
        Bold,
        Code,
        Italic,
        Strike,
        Underline,
        Dropcursor,
        Gapcursor,
        UndoRedo,
        ListKeymap,
        // starterkit end

        TableKit,
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
