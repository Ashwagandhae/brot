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

import Link from "@tiptap/extension-link";

import { IndentHandler } from "./editorTabExtension";
import { isTauri } from "./platform";

import { all, createLowlight } from "lowlight";
import {
  generateHTML,
  type AnyExtension,
  type JSONContent,
  type MarkdownRendererHelpers,
} from "@tiptap/core";

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
    // starterkit end

    // TableKit.configure({ table: { resizable: true } }).extend({
    //   renderMarkdown: renderTableToMarkdown,
    // }),

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
    Mathematics,
  ];

  return extensions;
}

function renderTableToHtml(node: JSONContent, extensions: AnyExtension[]) {
  if (!node || !node.content || node.content.length === 0) {
    return "";
  }

  const lines: string[] = [];

  const parserDiv = document.createElement("div");

  lines.push("<table>");

  node.content.forEach((rowNode) => {
    lines.push("  <tr>");

    if (rowNode.content) {
      rowNode.content.forEach((cellNode) => {
        const isHeader = cellNode.type === "tableHeader";
        const tag = isHeader ? "th" : "td";

        let cellHtml = "";

        if (cellNode.content && cellNode.content.length > 0) {
          // 1. Generate HTML string from JSON
          const jsonDoc = {
            type: "doc",
            content: cellNode.content,
          };
          const fullHtml = generateHTML(jsonDoc, extensions);

          // 2. Parse HTML using the browser DOM
          parserDiv.innerHTML = fullHtml;

          // 3. Check structure: If exactly 1 child and it is a <p>
          if (
            parserDiv.childElementCount === 1 &&
            parserDiv.firstElementChild?.tagName === "P"
          ) {
            // Unwrap: use the inner HTML of the paragraph
            cellHtml = parserDiv.firstElementChild.innerHTML;
          } else {
            // Keep original structure (multiple paragraphs, lists, etc.)
            cellHtml = fullHtml;
          }
        }

        lines.push(`    <${tag}>${cellHtml}</${tag}>`);
      });
    }

    lines.push("  </tr>");
  });

  lines.push("</table>");

  return lines.join("\n");
}

export function shouldRenderAsHTML(tableNode: JSONContent): boolean {
  const rows = tableNode.content || [];

  // 1. Must have rows
  if (rows.length === 0) return false;

  // 2. First row must be a header row (check first cell of first row)
  const firstRow = rows[0];
  const firstCell = firstRow.content?.[0];
  if (firstCell?.type !== "tableHeader") {
    return true; // Fallback to HTML if no header row
  }

  // Iterate all rows to check for complex content or merged cells
  for (const row of rows) {
    if (!row.content) continue;

    for (const cell of row.content) {
      // 3. Check for Merged Cells (Colspan/Rowspan)
      // Tiptap stores these in attrs. If attrs doesn't exist, it's default (1).
      const colspan = cell.attrs?.colSpan ?? 1;
      const rowspan = cell.attrs?.rowSpan ?? 1;

      if (colspan > 1 || rowspan > 1) {
        return true; // Complex geometry -> HTML
      }

      // 4. Check Content Complexity
      // Must have exactly one child
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
    }
  }

  // If we passed all gauntlets, it's safe to render as a pretty Markdown table
  return false;
}
