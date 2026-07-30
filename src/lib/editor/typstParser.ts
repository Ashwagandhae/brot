/* Copyright kxxt
 * Modified by Julian Bauer in 2026.
 * Licensed under the Apache License, Version 2.0.
 */
import {
	Tree,
	NodeType,
	type TreeFragment,
	NodeSet,
	Parser,
	type NodePropSource,
	type Input,
	type PartialParse,
	type SyntaxNode,
	type TreeBuffer,
} from "@lezer/common";
// @ts-ignore
import type { TypstWasmParser as TypstWasmParserType } from "@codemirror-lang-typst/wasm/typst_syntax.js";
import { StateField } from "@codemirror/state";
import { language } from "@codemirror/language";
import { mixedLanguageReplacer } from "./typstMixedLanguage.js";

export class TypstParseContext implements PartialParse {
	private parsed: number;
	stoppedAt: number | null = null;

	/// @internal
	constructor(
		readonly parser: TypstParser,
		/// @internal
		readonly input: Input,
		_fragments: readonly TreeFragment[],
		/// @internal
		readonly ranges: readonly { from: number; to: number }[],
	) {
		this.parsed = 0;
	}

	get parsedPos() {
		return this.parsed;
	}

	advance() {
		return this.parser.tree(this.input);
	}

	stopAt(pos: number) {
		if (this.stoppedAt != null && this.stoppedAt < pos)
			throw new RangeError("Can't move stoppedAt forward");
		this.stoppedAt = pos;
	}
}

type Edit = ChildrenSplice | UpdateParent;

type ChildrenSplice = {
	kind: "ChildrenSplice";
	prefix: [number];
	from: number;
	to: number;
	replacement: [any];
};

type UpdateParent = {
	kind: "UpdateParent";
	prefix: [number];
	prev: number;
	new: number;
};

// type Mutable<T> = { -readonly [P in keyof T]: T[P] };
class ChudInput {
	doc: string;
	length: number;
	lineChunks: boolean;
	constructor(doc: string) {
		this.doc = doc;
		this.length = doc.length;
		this.lineChunks = false;
	}
	chunk(from: number): string {
		return this.doc.slice(from);
	}
	read(from: number, to: number): string {
		return this.doc.slice(from, to);
	}
}
let wasmInitPromise: Promise<typeof TypstWasmParserType> | null = null;
export class TypstParser extends Parser {
	/// @internal
	parser: TypstWasmParserType | null;
	parserClass: typeof TypstWasmParserType;
	nodeSet: NodeSet;
	last_tree: Tree | null;

	/// @internal
	private constructor(
		highlighting: NodePropSource,
		TypstWasmParser: typeof TypstWasmParserType,
	) {
		super();
		this.parser = null;
		this.last_tree = null;
		const syntax_types = TypstWasmParser.get_node_types();
		const node_types = [NodeType.none];
		for (const [ty_name, ty_id] of syntax_types) {
			node_types.push(
				NodeType.define({
					name: ty_name,
					id: ty_id,
				}),
			);
		}
		this.parserClass = TypstWasmParser;
		this.nodeSet = new NodeSet(node_types).extend(highlighting);
	}
	static async create(highlighting: NodePropSource) {
		if (!wasmInitPromise) {
			wasmInitPromise = (async () => {
				// we must do this evil hack because https://github.com/sveltejs/kit/issues/15287
				const module = await import(
					// @ts-ignore
					"@codemirror-lang-typst/wasm/typst_syntax.js"
				);

				return module.TypstWasmParser;
			})();
		}
		let CachedWasmParser = await wasmInitPromise;
		return new TypstParser(highlighting, CachedWasmParser);
	}

	/// Get an update listener for syncing typst parser state with the document
	updateListener() {
		const parser = this;
		return StateField.define({
			create() {
				return null;
			},
			update(_value, transaction) {
				if (
					transaction.startState.facet(language) !==
					transaction.state.facet(language)
				) {
					parser.clearParser();
					return null;
				}
				if (transaction.docChanged) {
					transaction.changes.iterChanges(
						(fromA, toA, _fromB, _toB, inserted) => {
							const edits = parser.parser?.edit(
								fromA,
								toA,
								inserted.toString(),
							);
							if (edits.full_update) {
								parser.clearTree();
							} else {
								// Apply incremental edits
								for (const edit of edits.edits) {
									parser.applyTreeEdit(
										edit,
										new ChudInput(transaction.newDoc.toString()),
									);
								}
							}
						},
					);
				}
				return null;
			},
		});
	}

	createParse(
		input: Input,
		fragments: readonly TreeFragment[],
		ranges: readonly { from: number; to: number }[],
	): PartialParse {
		if (this.parser == null)
			this.parser = new this.parserClass(input.read(0, input.length));
		const parse: PartialParse = new TypstParseContext(
			this,
			input,
			fragments,
			ranges,
		);
		return parse;
	}

	clearTree() {
		this.last_tree = null;
	}

	/// Clears all internal parser state,
	/// This should be called when the editor state is being replaced, which won't cause
	/// a document change event and will cause the parse lose sync with the editor.
	clearParser() {
		this.parser = null;
		this.clearTree();
	}

	applyTreeEdit(edit: Edit, input: Input) {
		let parent: Tree;
		let positions: number[];
		switch (edit.kind) {
			case "ChildrenSplice": {
				parent = locateSubTree(this.last_tree!, edit.prefix);
				for (const newChild of edit.replacement) {
					mountPrototypes(this.nodeSet, newChild);
				}
				// calculate new length
				const superseded_length = (
					parent.children.slice(edit.from, edit.to) as Tree[]
				).reduce((acc: number, v: Tree) => acc + v.length, 0);
				const replacement_length = edit.replacement.reduce(
					(acc: number, v: Tree) => acc + v.length,
					0,
				);
				(parent.children as Tree[]).splice(
					edit.from,
					edit.to - edit.from,
					...edit.replacement,
				);
				positions = parent.positions as number[];
				positions.splice(
					edit.from,
					edit.to - edit.from,
					...new Array(edit.replacement.length).fill(0),
				);
				// @ts-ignore
				parent.length += replacement_length - superseded_length;
				let len_acc =
					(parent.positions[edit.from - 1] ?? 0) +
					(parent.children[edit.from - 1]?.length ?? 0);
				for (let i = edit.from; i < parent.positions.length; i++) {
					positions[i] = len_acc;
					len_acc += parent.children[i].length;
				}
				break;
			}
			case "UpdateParent": {
				const i = edit.prefix.pop()!;
				parent = locateSubTree(this.last_tree!, edit.prefix);
				const delta = edit.new - edit.prev;
				// @ts-ignore
				parent.length += delta;
				positions = parent.positions as number[];
				for (let j = i + 1; j < parent.positions.length; j++) {
					positions[j] += delta;
				}
				break;
			}
		}
		if (this.last_tree !== null) {
			this.last_tree = addMixedLanguage(input, this.last_tree);
		}
	}

	tree(input: Input): Tree | null {
		if (this.last_tree) return this.last_tree;
		const parsed = this.parser?.tree();
		if (parsed == null) return null;
		this.last_tree = mountPrototypes(this.nodeSet, parsed);
		this.last_tree = addMixedLanguage(input, this.last_tree);

		return this.last_tree;
	}
}

function addMixedLanguage(input: Input, tree: Tree): Tree {
	return mutateTreeWithNodeReplacer(tree, (node) =>
		mixedLanguageReplacer(input, node),
	) as Tree;
}

function mutateTreeWithNodeReplacer(
	treeNode: Tree,
	replacer: (node: SyntaxNode) => Tree | null,
	absoluteOffset = 0,
): Tree | TreeBuffer {
	const syntaxNode = treeNode.topNode;

	Object.defineProperties(syntaxNode, {
		from: { value: absoluteOffset, configurable: true },
		to: { value: absoluteOffset + treeNode.length, configurable: true },
	});

	const replacementTree = replacer(syntaxNode);
	if (replacementTree !== null) {
		if (!(replacementTree instanceof Tree)) {
			throw new TypeError(
				"Replacer must return a Lezer Tree instance or null.",
			);
		}

		return replacementTree;
	}

	for (let i = 0; i < treeNode.children.length; i++) {
		const child = treeNode.children[i];
		const relativePos = treeNode.positions[i];

		if (!(child instanceof Tree)) {
			// ignore non-Tree children
			continue;
		}

		(treeNode.children as (Tree | TreeBuffer)[])[i] =
			mutateTreeWithNodeReplacer(child, replacer, absoluteOffset + relativePos);
	}

	return treeNode;
}

function locateSubTree(tree: Tree, prefix: number[]): Tree {
	let curr = tree;
	for (const i of prefix) {
		curr = curr.children[i] as Tree;
	}
	return curr;
}

// Recursively mount prototypes onto the parsed tree
// biome-ignore lint/suspicious/noExplicitAny: it's ok
function mountPrototypes(nodeSet: NodeSet, tree: any): Tree {
	Object.setPrototypeOf(tree, Tree.prototype);
	tree.type = nodeSet.types[tree.kind];
	for (const child of tree.children) {
		mountPrototypes(nodeSet, child);
	}
	return tree;
}
