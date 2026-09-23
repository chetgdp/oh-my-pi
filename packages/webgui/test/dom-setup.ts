import { Window } from "happy-dom";

export const win = new Window();
export const NativeEvent = globalThis.Event;

const g = globalThis as Record<string, unknown>;
g.window = win;
g.document = win.document;
g.navigator = win.navigator;
g.Event = win.Event;
g.KeyboardEvent = win.KeyboardEvent;
g.IS_REACT_ACT_ENVIRONMENT = true;
