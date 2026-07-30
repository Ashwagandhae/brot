import {
	EditorState,
	RangeSet,
	RangeSetBuilder,
	type Extension,
} from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import type { SyntaxNode } from "@lezer/common";
import {
	Decoration,
	EditorView,
	ViewPlugin,
	type DecorationSet,
	type ViewUpdate,
} from "@codemirror/view";
import { isCursorInside } from "./typstTree";
const markupFuncs = {
	strike: {
		textDecoration: "line-through",
	},
	underline: {
		textDecoration: "underline",
	},
	overline: {
		textDecoration: "overline",
	},
	sub: {
		verticalAlign: "sub",
		fontSize: "0.75em",
		lineHeight: "0",
	},
	super: {
		verticalAlign: "super",
		fontSize: "0.75em",
		lineHeight: "0",
	},
	smallcaps: {
		fontVariant: "small-caps",
	},
	highlight: {
		background: "var(--highlight-color)",
	},
};
const markupFuncToClass = (func: string) => `cm-markup-func-${func}`;

export const inlineMarkupTheme: Extension = EditorView.theme({
	".cm-surrounder-hidden": {
		display: "inline-block",
		fontSize: "0 !important",
		width: "0 !important",
		letterSpacing: "-1ch !important",
		opacity: "0 !important",
		overflow: "hidden",
		verticalAlign: "middle",
	},
	".cm-markup-func-link,  .cm-markup-link": {
		color: "var(--link-color)",
		textDecoration: "underline",
	},
	...Object.fromEntries(
		Object.entries(markupFuncs).map(([key, val]) => [
			"." + markupFuncToClass(key),
			val,
		]),
	),
});
const hiddenMark = Decoration.mark({
	class: "cm-surrounder-hidden",
});
export const inlineMarkupPlugin = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;
		constructor(view: EditorView) {
			this.decorations = getInlineMarkupDecorations(view);
		}

		update(update: ViewUpdate) {
			if (update.docChanged || update.selectionSet || update.viewportChanged) {
				this.decorations = getInlineMarkupDecorations(update.view);
			}
		}
	},
	{
		decorations: (v) => v.decorations,
	},
);
function getInlineMarkupDecorations(view: EditorView) {
	return RangeSet.join(
		[
			getHideMarkDecorations,
			getMarkupFuncDecorations,
			getLinkFuncDecorations,
			getLinkDecorations,
		].map((f) => f(view)),
	);
}
function getHideMarkDecorations(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter(node) {
				if (isCursorInside(view.state, node)) return;
				const ranges = findSurrounder(node.node);
				if (ranges === null) return;
				for (const { from, to } of ranges) {
					builder.add(from, to, hiddenMark);
				}
			},
		});
	}
	return builder.finish();
}
function findSurrounder(
	node: SyntaxNode,
): { from: number; to: number }[] | null {
	if (node.name === "Emph") {
		return findSurrounderChar(node, "Underscore");
	} else if (node.name === "Strong") {
		return findSurrounderChar(node, "Star");
	} else if (node.name === "Raw") {
		return findRawSurrounder(node);
	}
	return null;
}
function findSurrounderChar(
	node: SyntaxNode,
	charName: string,
): { from: number; to: number }[] | null {
	if (node.firstChild?.name === charName && node.lastChild?.name === charName) {
		return [
			{
				from: node.firstChild.from,
				to: node.firstChild.to,
			},
			{
				from: node.lastChild.from,
				to: node.lastChild.to,
			},
		];
	}
	return null;
}
function findRawSurrounder(node: SyntaxNode) {
	if (
		node.firstChild?.name === "RawDelim" &&
		node.lastChild?.name === "RawDelim"
	) {
		const res = [
			{
				from: node.firstChild.from,
				to: node.firstChild.to,
			},
			{
				from: node.lastChild.from,
				to: node.lastChild.to,
			},
		];
		if (node.firstChild.nextSibling?.name == "RawLang") {
			res.splice(1, 0, node.firstChild.nextSibling);
		}
		return res;
	}
	return null;
}
function getMarkupFuncDecorations(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter(nodeRef) {
				if (isCursorInside(view.state, nodeRef)) return;
				const node = nodeRef.node;
				if (node.name !== "FuncCall") return;
				const ident = node.firstChild;
				if (ident?.name !== "Ident") return;
				const identVal = view.state.doc.slice(ident.from, ident.to).toString();
				if (!Object.keys(markupFuncs).includes(identVal)) return;
				const hash = node.prevSibling;
				if (hash?.name !== "Hash") return;
				const args = ident.nextSibling;
				if (args?.name !== "Args") return;
				const contentBlock = args.firstChild;
				if (contentBlock?.name !== "ContentBlock") return;
				if (contentBlock.nextSibling !== null) return; // ensure one child
				const leftBracket = contentBlock.firstChild;
				if (leftBracket?.name !== "LeftBracket") return;
				const rightBracket = contentBlock.lastChild;
				if (rightBracket?.name !== "RightBracket") return;
				const markup = contentBlock.firstChild?.nextSibling;
				if (markup?.name !== "Markup") return;

				for (const node of [hash, ident, leftBracket]) {
					builder.add(node.from, node.to, hiddenMark);
				}
				builder.add(
					markup.from,
					markup.to,
					Decoration.mark({
						class: markupFuncToClass(identVal),
					}),
				);
				builder.add(rightBracket.from, rightBracket.to, hiddenMark);
			},
		});
	}
	return builder.finish();
}
function getLinkFuncDecorations(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter(nodeRef) {
				if (isCursorInside(view.state, nodeRef)) return;
				const parts = getLinkFuncParts(nodeRef.node, view.state);
				if (parts == null) return;
				const {
					hash,
					ident,
					leftParen,
					str,
					rightParen,
					leftBracket,
					markup,
					rightBracket,
				} = parts;
				for (const node of [
					hash,
					ident,
					leftParen,
					str,
					rightParen,
					leftBracket,
				]) {
					builder.add(node.from, node.to, hiddenMark);
				}
				builder.add(
					markup.from,
					markup.to,
					Decoration.mark({
						class: "cm-markup-func-link",
					}),
				);
				builder.add(rightBracket.from, rightBracket.to, hiddenMark);
			},
		});
	}
	return builder.finish();
}
function getLinkFuncParts(
	node: SyntaxNode,
	state: EditorState,
): {
	hash: SyntaxNode;
	ident: SyntaxNode;
	leftParen: SyntaxNode;
	str: SyntaxNode;
	rightParen: SyntaxNode;
	leftBracket: SyntaxNode;
	markup: SyntaxNode;
	rightBracket: SyntaxNode;
} | null {
	if (node.name !== "FuncCall") return null;
	const ident = node.firstChild;
	if (ident?.name !== "Ident") return null;
	const identVal = state.doc.slice(ident.from, ident.to).toString();
	if (identVal !== "link") return null;
	const hash = node.prevSibling;
	if (hash?.name !== "Hash") return null;
	const args = ident.nextSibling;
	if (args?.name !== "Args") return null;

	const leftParen = args.firstChild;
	if (leftParen?.name !== "LeftParen") return null;
	const str = leftParen.nextSibling;
	if (str?.name !== "Str") return null;
	const rightParen = str.nextSibling;
	if (rightParen?.name !== "RightParen") return null;

	const contentBlock = rightParen.nextSibling;
	if (contentBlock?.name !== "ContentBlock") return null;
	if (contentBlock.nextSibling !== null) return null; // ensure one child
	const leftBracket = contentBlock.firstChild;
	if (leftBracket?.name !== "LeftBracket") return null;
	const rightBracket = contentBlock.lastChild;
	if (rightBracket?.name !== "RightBracket") return null;
	const markup = contentBlock.firstChild?.nextSibling;
	if (markup?.name !== "Markup") return null;
	return {
		hash,
		ident,
		leftParen,
		str,
		rightParen,
		leftBracket,
		markup,
		rightBracket,
	};
}
function getLinkDecorations(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter(node) {
				if (node.name == "Link") {
					builder.add(
						node.from,
						node.to,
						Decoration.mark({ class: "cm-markup-link" }),
					);
				}
			},
		});
	}
	return builder.finish();
}
export const clickableLinkHandler = (options: {
	linkHandler: (url: string) => void;
}) =>
	EditorView.domEventHandlers({
		click(event, view) {
			const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
			if (pos == null) return;
			const node = syntaxTree(view.state).resolveInner(pos);
			if (node.name === "Link") {
				options.linkHandler(view.state.sliceDoc(node.from, node.to));
			} else {
				const linkFuncNode = findAncestorOfName(node, "FuncCall");
				if (linkFuncNode == null) return;
				const parts = getLinkFuncParts(linkFuncNode, view.state);
				if (parts == null) return;
				const { str } = parts;
				options.linkHandler(view.state.sliceDoc(str.from + 1, str.to - 1));
			}
		},
	});
export function findAncestorOfName(
	node: SyntaxNode,
	name: string,
): SyntaxNode | null {
	let curr: SyntaxNode | null = node;
	while (curr != null) {
		if (curr.name == name) return curr;

		curr = curr.parent;
	}
	return null;
}
