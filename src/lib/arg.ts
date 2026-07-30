import type { Locater } from "../../src-tauri/bindings/Locater";
import { type WithProps } from "./componentProps";
import {
	parseLangFromString,
	parseLatexRenderFromString,
	parseNumberFromString,
	parseUrlFromString,
	unwrapParse,
	type LatexRender,
} from "./parse";

export type ArgTypesMap = {
	locater: Locater;
	notePath: string;
	insertion: "above" | "below";
	boolean: boolean;
	palette: string;
	number: number;
	url: URL;
	level: 1 | 2 | 3 | 4 | 5 | 6;
	lang: string;
	latex: LatexRender;
};

function verifyEnum<T extends string>(val: string, options: T[]): T;
function verifyEnum<T extends number>(val: number, options: T[]): T;
function verifyEnum<T extends string | number>(val: T, options: T[]): T {
	if (options.includes(val)) {
		return val;
	}
	throw new Error(`Failed to verify value ${val}`);
}

export const parsers: {
	[K in keyof ArgTypesMap]: (val: string) => ArgTypesMap[K];
} = {
	notePath: (val) => val,
	insertion: (val) => verifyEnum(val, ["above", "below"]),
	level: (val) => verifyEnum(Number(val), [1, 2, 3, 4, 5, 6]),
	boolean: (val) => val === "true",
	palette: (val) => val,
	locater: (val) => val as Locater,
	number: unwrapParse(parseNumberFromString),
	url: unwrapParse(parseUrlFromString),
	lang: unwrapParse(parseLangFromString),
	latex: unwrapParse(parseLatexRenderFromString),
};

export type ArgPaletteMap = {
	[K in keyof ArgTypesMap]: WithProps<
		{ onfinish: (arg: ArgTypesMap[K] | null) => void },
		"onfinish"
	>;
};
