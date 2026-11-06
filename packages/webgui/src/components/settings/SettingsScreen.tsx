/**
 * Settings screen (route `#/settings`): World hour and app background mode.
 * Lazy chunk; App.tsx loads it on the settings route.
 */
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useSignalAppReadyWhen } from "../../lib/splash-signal";
import {
	formatWorldHour,
	readWorldSetting,
	subscribeWorldSetting,
	type WorldSetting,
	worldHour,
	writeWorldSetting,
} from "../../lib/world-setting";
import { effectiveBackground } from "../../splash/background-device";
import type { BackgroundMode } from "../../splash/background-mode";
import {
	BACKGROUND_SETTINGS,
	type BackgroundSetting,
	readBackgroundSetting,
	subscribeBackgroundSetting,
	writeBackgroundSetting,
} from "../../splash/background-setting";
import { backgroundModule } from "../../splash/chunks";
import { browserWindow } from "../../lib/dom";
// Text, injected with this lazy chunk: a CSS import would become a render-blocking <link> in index.html.
import SETTINGS_CSS from "./settings.css" with { type: "text" };

let styled = false;
function injectStyle(): void {
	if (styled) return;
	styled = true;
	// read at call time: `browserDocument` is bound when lib/dom first loads, which may precede the DOM
	const document = browserWindow.document;
	const style = document.createElement("style") as unknown as { textContent: string };
	style.textContent = SETTINGS_CSS;
	document.body.appendChild(style);
}

const DAY_HOUR = 12.5;
const NIGHT_HOUR = 23;
const SLIDER_STEP = 0.25;

const BACKGROUND_LABEL: Record<BackgroundSetting, string> = { auto: "Auto", live: "Live", still: "Still", off: "Off" };

function useWorldSetting(): WorldSetting {
	const [world, setWorld] = useState(readWorldSetting);
	useEffect(() => subscribeWorldSetting(() => setWorld(readWorldSetting())), []);
	return world;
}

function WorldSection(): ReactNode {
	const world = useWorldSetting();
	const auto = world.mode === "auto";
	const hour = worldHour(world);
	const fix = (h: number): void => writeWorldSetting({ mode: "fixed", hour: h });
	return (
		<section className="st-section" aria-labelledby="st-world">
			<h2 id="st-world" className="st-title">
				World
			</h2>
			<p className="st-hint">The hour the scene shows. The interface follows its light.</p>
			<label className="st-row">
				<span>Follow the local clock</span>
				<input
					type="checkbox"
					role="switch"
					checked={auto}
					onChange={e => (e.currentTarget.checked ? writeWorldSetting({ mode: "auto" }) : fix(hour))}
				/>
			</label>
			<div className="st-row">
				<input
					className="st-slider"
					type="range"
					min={0}
					max={24}
					step={SLIDER_STEP}
					value={hour}
					aria-label="Hour of day"
					aria-valuetext={formatWorldHour(hour)}
					onChange={e => fix(Number(e.currentTarget.value))}
				/>
				<output className="st-value">{auto ? `${formatWorldHour(hour)} now` : formatWorldHour(hour)}</output>
			</div>
			<div className="cc-seg" role="group" aria-label="Hour presets">
				<button
					type="button"
					className={!auto && hour === DAY_HOUR ? "cc-on" : undefined}
					aria-pressed={!auto && hour === DAY_HOUR}
					onClick={() => fix(DAY_HOUR)}
				>
					<Sun size={15} /> Day
				</button>
				<button
					type="button"
					className={!auto && hour === NIGHT_HOUR ? "cc-on" : undefined}
					aria-pressed={!auto && hour === NIGHT_HOUR}
					onClick={() => fix(NIGHT_HOUR)}
				>
					<Moon size={15} /> Night
				</button>
			</div>
		</section>
	);
}

const MODE_LABEL: Record<BackgroundMode, string> = { live: "Live", still: "Still", off: "Off" };

/** The running mode when it differs from the choice (URL or reduced motion), or what Auto picked. */
function modeNote(setting: BackgroundSetting): string | null {
	const { mode, override } = effectiveBackground(setting);
	if (override === "url") return `Showing ${MODE_LABEL[mode]}: set by ?bg= in the address.`;
	if (override === "reduced-motion") return "Showing Off: the system asks for reduced motion.";
	if (setting === "auto") return `Auto shows ${MODE_LABEL[mode]} here.`;
	return null;
}

function BackgroundSection(): ReactNode {
	const [setting, setSetting] = useState(readBackgroundSetting);
	useEffect(() => subscribeBackgroundSetting(() => setSetting(readBackgroundSetting())), []);
	const pick = (s: BackgroundSetting): void => {
		writeBackgroundSetting(s);
		// the background (lazy chunk) holds the running mode; picking Live again restarts a guard-stepped still
		void backgroundModule.load().then(m => m.appBackground.setSetting(s));
	};
	const note = modeNote(setting);
	return (
		<section className="st-section" aria-labelledby="st-bg">
			<h2 id="st-bg" className="st-title">
				Background
			</h2>
			<p className="st-hint">Auto runs the live scene on large windows with a mouse and a still image elsewhere.</p>
			{note && <p className="st-hint st-note">{note}</p>}
			<div className="cc-seg" role="group" aria-label="Background mode">
				{BACKGROUND_SETTINGS.map(s => (
					<button
						key={s}
						type="button"
						className={setting === s ? "cc-on" : undefined}
						aria-pressed={setting === s}
						onClick={() => pick(s)}
					>
						{BACKGROUND_LABEL[s]}
					</button>
				))}
			</div>
		</section>
	);
}

export function SettingsScreen(): ReactNode {
	injectStyle();
	// a deep link to Settings has nothing else to wait for: end the splash
	useSignalAppReadyWhen(true);
	return (
		<div className="st-screen">
			<WorldSection />
			<BackgroundSection />
		</div>
	);
}
