// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { Note } from "./Note";
import type { PartialActionFilter } from "./PartialActionFilter";
import type { Settings } from "./Settings";

export type ClientMessage = { "type": "RequestSettings" } | { "type": "UpdateSettings", settings: Settings, } | { "type": "RequestNote", path: string, } | { "type": "UpdateNote", path: string, note: Note, } | { "type": "CreateNote", title: string, } | { "type": "GetPaletteActions", palette_key: string, search: string, filters: Array<PartialActionFilter>, } | { "type": "AddPinned", path: string, position: number, } | { "type": "RemovePinned", path: string, } | { "type": "GetPinned" } | { "type": "GetActions" } | { "type": "Refresh" };
