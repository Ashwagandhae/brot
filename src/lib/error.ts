import { writable, type Writable } from "svelte/store";

export let errorMessage: Writable<string | null> = writable(null);
