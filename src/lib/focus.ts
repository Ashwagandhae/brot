import { getContext, setContext } from "svelte";
import type { Writable } from "svelte/store";

export type FocusState = {
	ignoreAutoFocus: boolean;
};
export function setFocusStateContext(focusState: Writable<FocusState>) {
	setContext("focusState", focusState);
}

export function getFocusStateContext(): Writable<FocusState> {
	return getContext("focusState");
}
