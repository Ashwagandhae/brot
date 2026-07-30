import {
	defineLanguageFacet,
	Language,
	LanguageSupport,
} from "@codemirror/language";
import { TypstParser } from "./typstParser";
import { typstHighlight } from "./typstHighlight";
import { EditorState } from "@codemirror/state";

export async function typst(): Promise<LanguageSupport> {
	const parser = await TypstParser.create(typstHighlight);
	const updateListener = parser.updateListener();

	const data = defineLanguageFacet();
	return new LanguageSupport(
		new Language(data, parser, [updateListener], "typst"),
		[
			EditorState.languageData.of(() => [
				{
					closeBrackets: {
						brackets: ["(", "[", "{", '"', "`", "$"],
					},
					commentTokens: {
						line: "//",
						block: {
							open: "/*",
							close: "*/",
						},
					},
					wordChars: "-_",
					indentOnInput: /^\s*[[\]{}()]$/,
				},
			]),
		],
	);
}
