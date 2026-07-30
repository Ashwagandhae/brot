import { HighlightStyle } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { typstTags } from "./typstHighlight";
// import { typstTags as tt } from "./typstHighlight";

export const tagHighlight = HighlightStyle.define([
	{
		tag: t.heading,
		textDecoration: "none",
		color: "var(--text)",
	},
	{
		tag: t.content,
		fontFamily: "var(--font-prop)",
		fontSize: "var(--font-size)",
	},
	{
		tag: t.monospace,
		fontFamily: "var(--font-mono)",
		background: "var(--back-translucent)",
		borderRadius: "4px",
	},
	{ tag: typstTags.codeSpace, fontFamily: "var(--font-mono)" },
	{ tag: typstTags.contentSpace, fontFamily: "var(--font-prop)" },
]);
