import { HTMLarkdown } from "htmlarkdown";
import { Marked, marked, type RendererObject } from "marked";
import { markedHighlight } from "marked-highlight";
import TurndownService from "turndown";

// let markdown = new HTMLarkdown({
//   codeblockTrailingLinebreak: "add",
//   addTrailingLinebreak: false,
// });
// markdown.addRule({
//   filter: ["span"],
//   replacement: (element) => {
//     return element.outerHTML;
//   },
// });
// markdown.addRule({
//   filter: ["details"],
//   replacement: (element) => {
//     return element.outerHTML;
//   },
// });

// markdown.addRule({
//   filter: ["pre"],
//   replacement: (element) => {
//     let lang = Array.from(element.querySelector("code")?.classList!)
//       .find((s) => s.startsWith("language-"))
//       ?.substring("language-".length);
//     return "```" + lang + "\n" + element.textContent?.trim() + "\n```\n";
//   },
// });

let myMarked = new Marked(
  markedHighlight({
    emptyLangClass: "",
    langPrefix: "language-",
    highlight(code) {
      return code;
    },
  })
);

const renderer: RendererObject = {
  code({ text, lang }) {
    const clean = text.replace(/\n$/, "");
    const langAttr = lang ? ` class="language-${lang}"` : "";
    return `<pre><code${langAttr}>${clean}</code></pre>`;
  },
};

myMarked.use({ renderer });

let turndownService = new TurndownService({
  bulletListMarker: "-",
  fence: "```",
  strongDelimiter: "**",
});

turndownService.addRule("code", {
  filter: ["pre"],
  replacement: (content, element) => {
    let lang = Array.from(element.querySelector("code")?.classList!)
      .find((s) => s.startsWith("language-"))
      ?.substring("language-".length);
    return "```" + lang + "\n" + element.textContent?.trim() + "\n```\n";
  },
});
export function htmlToMarkdown(html: string) {
  let md = turndownService.turndown(html);
  return md;
}

export function markdownToHtml(md: string) {
  let html = myMarked.parse(md);
  console.log(html);
  return html;
}
