import type { SyntaxNode } from "@lezer/common";
import type { EditorState } from "@codemirror/state";
export function getFuncCallName(
	node: SyntaxNode,
	state: EditorState,
): string | null {
	if (node.name !== "FuncCall") return null;
	const ident = node.firstChild;
	if (ident == null || ident.name !== "Ident") {
		return null;
	}
	const funcName = state.sliceDoc(ident.from, ident.to);
	return funcName;
}
export function isEquationBlockEquation(node: SyntaxNode): boolean {
	return (
		node.firstChild?.nextSibling?.name === "Space" &&
		node.lastChild?.prevSibling?.name === "Space"
	);
}
export function isCursorInside(
	state: EditorState,
	range: { from: number; to: number },
): boolean {
	for (const selection of state.selection.ranges) {
		if (selection.from <= range.to && selection.to >= range.from) {
			return true;
		}
	}
	return false;
}
