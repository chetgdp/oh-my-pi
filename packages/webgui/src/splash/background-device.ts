/**
 * The running background mode for a stored setting on this device and URL,
 * and why it differs from the setting. Shared by the background controller
 * and the Settings screen (both lazy).
 */
import { browserWindow } from "../lib/dom";
import {
	type BackgroundMode,
	type BackgroundOverride,
	backgroundOverride,
	type DeviceTraits,
	resolveBackgroundMode,
} from "./background-mode";
import type { BackgroundSetting } from "./background-setting";

function deviceTraits(): DeviceTraits {
	const media = (q: string) => browserWindow.matchMedia(q).matches;
	return {
		finePointer: media("(pointer: fine)"),
		width: browserWindow.innerWidth,
		reducedMotion: media("(prefers-reduced-motion: reduce)"),
	};
}

export function effectiveBackground(setting: BackgroundSetting): {
	mode: BackgroundMode;
	override: BackgroundOverride | null;
} {
	const param = new URLSearchParams(browserWindow.location.search).get("bg");
	const device = deviceTraits();
	return { mode: resolveBackgroundMode(setting, param, device), override: backgroundOverride(setting, param, device) };
}
