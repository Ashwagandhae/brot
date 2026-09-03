import { bracketMatching, syntaxHighlighting } from "@codemirror/language";
import {
	history,
	insertNewlineAndIndent,
	insertNewlineKeepIndent,
} from "@codemirror/commands";
import { highlightSpecialChars, drawSelection, keymap } from "@codemirror/view";
import { Prec, EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "codemirror";
import { dynamicHeadingSizes, dynamicHeadingTheme } from "./heading";
import { indentPlugin, listPlugin, listTheme } from "./list";
import { tagHighlight } from "./tagHighlight";
import { typst } from "./typstLang";
import { oneDarkHighlightStyle } from "@codemirror/theme-one-dark";
import { defaultKeymap } from "@codemirror/commands";
import {
	previewTheme,
	previewTooltipField,
	previewDecorationPlugin,
} from "./previewRender";
import { previewStateField, updateSourcePlugin } from "./previewExtension";
import {
	clickableLinkHandler,
	inlineMarkupPlugin,
	inlineMarkupTheme,
} from "./inlineMarkup";
import { closeBrackets } from "@codemirror/autocomplete";
import { theme } from "./theme";
import { previewLinter } from "./previewLinter";
import { helix } from "./helix/lib";
import { commands, type TypableCommand } from "./helix/lib";

export type Options = {
	helix: boolean;
	linkHandler: (url: string) => void;
	commands?: TypableCommand[];
};

export async function typstishLivePreview(
	options: Options,
): Promise<Extension> {
	const livePreview = Prec.highest([
		syntaxHighlighting(oneDarkHighlightStyle),
		syntaxHighlighting(tagHighlight),
		theme,
		dynamicHeadingSizes,
		dynamicHeadingTheme,
		inlineMarkupTheme,
		inlineMarkupPlugin,
		clickableLinkHandler({
			linkHandler: options.linkHandler,
		}),
		listTheme,
		listPlugin,
		indentPlugin,
		previewStateField,
		updateSourcePlugin,
		previewTheme,
		previewDecorationPlugin,
		previewTooltipField,
		previewLinter,
	]);
	const res = [
		highlightSpecialChars(),
		history(),
		drawSelection(),
		await typst(),
		EditorView.lineWrapping,
		EditorState.tabSize.of(2),
		bracketMatching(),
		closeBrackets(),
	];
	if (options.helix) {
		res.push(
			Prec.high([
				helix({
					config: { "editor.cursor-shape.insert": "bar" },
					drawSelection: false,
					linkHandler: options.linkHandler,
				}),
				commands.of(options.commands ?? []),
			]),
		);
	} else {
		res.push(
			Prec.highest(
				keymap.of([
					{
						key: "Enter",
						run: insertNewlineKeepIndent,
					},
				]),
			),
		);
		res.push(Prec.high(keymap.of(defaultKeymap)));
	}
	res.push(livePreview);
	return res;
}
