<script lang="ts">
  import "./editorTipTap.css";
  import { onMount } from "svelte";
  import TextStyle from "@tiptap/extension-text-style";
  import StarterKit from "@tiptap/starter-kit";
  import Table from "@tiptap/extension-table";
  import TableCell from "@tiptap/extension-table-cell";
  import TableHeader from "@tiptap/extension-table-header";
  import TableRow from "@tiptap/extension-table-row";
  import { Editor } from "@tiptap/core";
  import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
  import { readText } from "@tauri-apps/plugin-clipboard-manager";

  import Link from "@tiptap/extension-link";

  import { all, createLowlight } from "lowlight";

  import { HTMLarkdown } from "htmlarkdown";
  import "katex/dist/katex.min.css";
  import { MathExtension } from "@aarkue/tiptap-math-extension";
  import { Marked } from "marked";
  import { markedHighlight } from "marked-highlight";
  import { IndentHandler } from "./editorTabExtension";
  import type { ActionRegistry } from "./actions";
  import { isTauri } from "./platform";

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
    return markdown.convert(html);
  }

  function markdownToHtml(md: string) {
    return myMarked.parse(md);
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
        TextStyle,
        StarterKit.configure({
          codeBlock: false,
        }),
        MathExtension,
        Table,
        TableCell,
        TableHeader,
        TableRow,
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
