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
  import type { ActionRegistry } from "./actions";
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
    registry: ActionRegistry;
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
    registry.editorToggleBold = () => {
      editor.chain().focus().toggleBold().run();
    };
    registry.getEditor = () => editor;
    registry.pasteWithoutFormatting = () => {
      if (isTauri()) {
        readText().then((val) => {
          editor.commands.insertContent(val);
        });
      }
    };
    registry.setLink = (url: string) => {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    };
    registry.unsetLink = () => {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    };
    registry.insertTable = () => {
      editor
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    };
    registry.addColumnBefore = () =>
      editor.chain().focus().addColumnBefore().run();
    registry.addColumnAfter = () =>
      editor.chain().focus().addColumnAfter().run();
    registry.deleteColumn = () => editor.chain().focus().deleteColumn().run();
    registry.addRowBefore = () => editor.chain().focus().addRowBefore().run();
    registry.addRowAfter = () => editor.chain().focus().addRowAfter().run();
    registry.deleteRow = () => editor.chain().focus().deleteRow().run();
    registry.deleteTable = () => editor.chain().focus().deleteTable().run();
    registry.mergeCells = () => editor.chain().focus().mergeCells().run();
    registry.splitCell = () => editor.chain().focus().splitCell().run();
    registry.toggleHeaderColumn = () =>
      editor.chain().focus().toggleHeaderColumn().run();
    registry.toggleHeaderRow = () =>
      editor.chain().focus().toggleHeaderRow().run();
    registry.toggleHeaderCell = () =>
      editor.chain().focus().toggleHeaderCell().run();
    registry.mergeOrSplit = () => editor.chain().focus().mergeOrSplit().run();
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
