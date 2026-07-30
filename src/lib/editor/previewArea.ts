import {
	type EditorState,
	RangeSetBuilder,
	RangeValue,
} from "@codemirror/state";
import {
	getFuncCallName,
	isCursorInside,
	isEquationBlockEquation,
} from "./typstTree";
import { syntaxTree } from "@codemirror/language";
import type { SyntaxNodeRef } from "@lezer/common";

export class PreviewArea extends RangeValue {
	docRange: { from: number; to: number };
	isBlock: boolean;
	constructor(from: number, to: number, isBlock: boolean) {
		super();
		this.docRange = { from, to };
		this.isBlock = isBlock;
	}
	isTooltip(state: EditorState): boolean {
		if (this.isBlock) return false;
		return this.isCursorInside(state);
	}
	isCursorInside(state: EditorState): boolean {
		return isCursorInside(state, this.docRange);
	}
}

export function getPreviewAreas(
	ranges: readonly { from: number; to: number }[],
	state: EditorState,
) {
	const tree = syntaxTree(state);
	const docLength = state.doc.length;
	const rangedPreviewsBuilder: RangeSetBuilder<PreviewArea> =
		new RangeSetBuilder();
	const addArea = (
		node: SyntaxNodeRef,
		from: number,
		to: number,
		isBlock: boolean,
	) => {
		const safeFrom = Math.min(node.from, docLength);
		const safeTo = Math.min(node.to, docLength);

		if (safeFrom <= safeTo) {
			rangedPreviewsBuilder.add(
				safeFrom,
				safeTo,
				new PreviewArea(from, to, isBlock),
			);
		}
	};
	for (const { from, to } of ranges) {
		tree.iterate({
			from,
			to,
			enter: (node) => {
				if (node.name === "Equation") {
					addArea(node, node.from, node.to, isEquationBlockEquation(node.node));
					return false;
				} else if (node.name === "FuncCall") {
					const funcName = getFuncCallName(node.node, state);
					let from = node.from;
					if (node.node.prevSibling?.name === "Hash") {
						from = node.node.prevSibling.from;
					}
					if (funcName === "block") {
						addArea(node, from, node.to, true);
						return false;
					} else if (funcName === "box") {
						addArea(node, from, node.to, false);
						return false;
					}
				}
			},
		});
	}
	return rangedPreviewsBuilder.finish();
}
