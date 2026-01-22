import Blockquote from "@tiptap/extension-blockquote";
import { BulletList } from "@tiptap/extension-list";
import Document from "@tiptap/extension-document";
import HardBreak from "@tiptap/extension-hard-break";
import Heading from "@tiptap/extension-heading";
import Mathematics from "@tiptap/extension-mathematics";
import { ListItem } from "@tiptap/extension-list";
import { OrderedList } from "@tiptap/extension-list";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { Markdown } from "@tiptap/markdown";
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
import {
  TableKit,
  Table,
  TableCell,
  TableHeader,
  TableRow,
  renderTableToMarkdown,
} from "@tiptap/extension-table";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createVirtualCursor } from "prosemirror-virtual-cursor";

import Link from "@tiptap/extension-link";

import { IndentHandler } from "./editorTabExtension";
import { isTauri } from "./platform";

import { all, createLowlight } from "lowlight";
import {
  Extension,
  generateHTML,
  type AnyExtension,
  type JSONContent,
} from "@tiptap/core";
import { MathInline, MathBlock } from "./MathExtension";

let lowlight = createLowlight(all);

export function initExtensions() {
  let extensions: AnyExtension[] = [
    // starterkit:
    HardBreak.extend({ addKeyboardShortcuts: () => ({}) }),
    Blockquote.extend({ addKeyboardShortcuts: () => ({}) }),
    BulletList.extend({ addKeyboardShortcuts: () => ({}) }),
    Document,
    Heading.extend({ addKeyboardShortcuts: () => ({}) }),
    ListItem,
    OrderedList,
    Paragraph.extend({ addKeyboardShortcuts: () => ({}) }),
    Text,
    Bold.extend({
      addKeyboardShortcuts: () => ({}),
      addInputRules: () => [],
      addPasteRules: () => [],
    }),
    Code.extend({ addKeyboardShortcuts: () => ({}) }),
    Italic.extend({
      addKeyboardShortcuts: () => ({}),
      addInputRules: () => [],
      addPasteRules: () => [],
    }),
    Strike.extend({ addKeyboardShortcuts: () => ({}) }),
    Underline.extend({ addKeyboardShortcuts: () => ({}) }),
    Dropcursor,
    Gapcursor,
    UndoRedo.extend({ addKeyboardShortcuts: () => ({}) }),

    Table.configure({ resizable: true }).extend({
      renderMarkdown(node, helpers, ctx) {
        if (shouldRenderAsHTML(node)) {
          return renderTableToHtml(node, extensions);
        }
        return renderTableToMarkdown(node, helpers);
      },
    }),
    TableCell,
    TableHeader,
    TableRow,
    CodeBlockLowlight.configure({
      lowlight,
      defaultLanguage: "plaintext",
    }).extend({ addKeyboardShortcuts: () => ({}) }),
    Link.configure({
      openOnClick: !isTauri(),
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
    Markdown,
    // Mathematics,
    // MathBlock,
    MathInline,
    MathBlock,
    Extension.create({
      addProseMirrorPlugins() {
        return [createVirtualCursor()];
      },
    }),
  ];

  return extensions;
}

export function renderTableToHtml(
  node: JSONContent,
  extensions: AnyExtension[],
) {
  if (!node) return "";

  //
  const rawHtml = generateHTML({ type: "doc", content: [node] }, extensions);

  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = rawHtml;
  const table = tempDiv.firstElementChild as HTMLTableElement;

  if (!table) return "";

  const lines: string[] = [];
  lines.push("<table>");

  Array.from(table.rows).forEach((row) => {
    lines.push("  <tr>");

    Array.from(row.cells).forEach((cell) => {
      if (
        cell.childElementCount === 1 &&
        cell.firstElementChild?.tagName === "P"
      ) {
        const p = cell.firstElementChild;
        while (p.firstChild) {
          cell.insertBefore(p.firstChild, p);
        }
        p.remove();
      }

      if (cell.getAttribute("colspan") === "1") {
        cell.removeAttribute("colspan");
      }
      if (cell.getAttribute("rowspan") === "1") {
        cell.removeAttribute("rowspan");
      }

      const colwidth = cell.getAttribute("data-colwidth");
      if (colwidth) {
        cell.style.width = `${colwidth}px`;
        cell.removeAttribute("data-colwidth");
      }

      lines.push(`    ${cell.outerHTML}`);
    });

    lines.push("  </tr>");
  });

  lines.push("</table>");

  return lines.join("\n");
}

export function shouldRenderAsHTML(tableNode: JSONContent): boolean {
  const rows = tableNode.content || [];

  // 1. must have rows
  if (rows.length === 0) return false;

  // 2. first row must be a header row
  const firstRow = rows[0];
  const firstCell = firstRow.content?.[0];
  if (firstCell?.type !== "tableHeader") {
    return true; // Fallback to HTML if no header row
  }

  for (const row of rows) {
    if (!row.content) continue;

    for (const cell of row.content) {
      // 3. check for Merged Cells (Colspan/Rowspan)
      const colspan = cell.attrs?.colSpan ?? 1;
      const rowspan = cell.attrs?.rowSpan ?? 1;

      if (colspan > 1 || rowspan > 1) {
        return true; // Complex geometry -> HTML
      }

      // 4. check Content Complexity
      if (!cell.content || cell.content.length !== 1) {
        // Exception: Empty cells (length 0) are fine in Markdown
        if (cell.content && cell.content.length === 0) continue;
        return true; // Multiple paragraphs/blocks -> HTML
      }

      // 5. The single child must be a Paragraph
      const child = cell.content[0];
      if (child.type !== "paragraph") {
        return true; // Lists, headings, code blocks -> HTML
      }

      // 6. Tiptap stores colwidth as an array of numbers (e.g. [150]) or null
      if (cell.attrs?.colwidth && cell.attrs.colwidth.length > 0) {
        return true; // Widths exist -> Must use HTML to preserve them
      }
    }
  }
  return false;
}
