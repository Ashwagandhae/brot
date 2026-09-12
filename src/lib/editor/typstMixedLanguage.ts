import { Tree, type Input, type SyntaxNode, Parser } from "@lezer/common";
import { parser as pyParser } from "@lezer/python";
import { parser as jsParser } from "@lezer/javascript";
// @ts-ignore
import { parser as tomlParser } from "lezer-toml";

const langParsers: Partial<Record<string, Parser>> = {
	python: pyParser,
	py: pyParser,
	javascript: jsParser,
	js: jsParser,
	toml: tomlParser,
};

export function mixedLanguageReplacer(
	input: Input,
	node: SyntaxNode,
): Tree | null {
	if (node.name === "Raw") {
		const startDelim = node.firstChild;
		const lang = startDelim?.nextSibling;
		const endDelim = node.lastChild;
		if (
			startDelim?.name !== "RawDelim" ||
			lang?.name !== "RawLang" ||
			endDelim?.name !== "RawDelim" ||
			startDelim === endDelim
		) {
			return null;
		}
		const langName = input.read(lang.from, lang.to);
		const parser = langParsers[langName];
		if (parser == null) {
			return null;
		}

		const codeStart = lang.to;
		const codeEnd = endDelim.from;
		const snippet = input.read(codeStart, codeEnd);

		let langTree = parser.parse(snippet);

		const newChildren: (Tree | any)[] = [];
		const newPositions: number[] = [];

		const pushLeaf = (leafNode: SyntaxNode) => {
			newChildren.push(
				new Tree(leafNode.type, [], [], leafNode.to - leafNode.from),
			);
			newPositions.push(leafNode.from - node.from);
		};

		pushLeaf(startDelim);
		pushLeaf(lang);

		newChildren.push(langTree);
		newPositions.push(codeStart - node.from);

		pushLeaf(endDelim);

		return new Tree(node.type, newChildren, newPositions, node.to - node.from);
	}

	return null;
}
