import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { ThinkingLevel } from "@oh-my-pi/pi-agent-core/thinking";
import type {
	RpcBrowserModel,
	RpcModelBrowserResult,
	RpcModelPerf,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import { RotateCw, X, Lock } from "lucide-react";
import { browserDocument } from "../../lib/dom";
import type { ModelPickerSheetProps, PickerSelection, RoleStorage } from "./contract";
import type { ConfiguredThinkingLevel } from "../../lib/session-actions";
import "./picker.css";

const LEVELS: readonly ConfiguredThinkingLevel[] = [
	"auto",
	ThinkingLevel.Off,
	ThinkingLevel.Minimal,
	ThinkingLevel.Low,
	ThinkingLevel.Medium,
	ThinkingLevel.High,
	ThinkingLevel.XHigh,
	ThinkingLevel.Max,
];

export interface FilterOptions {
	kind?: string;
	eligible?: string[];
	query?: string;
}

/**
 * Filter browser models according to kind tab, eligible list, and search query.
 */
export function filterBrowserModels(browser: RpcModelBrowserResult | null, options: FilterOptions): RpcBrowserModel[] {
	if (!browser?.models) return [];

	let list = browser.models;

	// Eligible filter applies before search
	if (options.eligible && options.eligible.length > 0) {
		const eligibleSet = new Set(options.eligible);
		list = list.filter(m => eligibleSet.has(m.selector) || eligibleSet.has(`${m.provider}/${m.id}`));
	}

	// Kind tab filter
	if (options.kind && options.kind !== "all") {
		list = list.filter(m => m.kind === options.kind);
	}

	// Query search filter
	const q = options.query?.trim().toLowerCase();
	if (q) {
		list = list.filter(
			m =>
				m.name.toLowerCase().includes(q) ||
				m.id.toLowerCase().includes(q) ||
				m.provider.toLowerCase().includes(q) ||
				(m.tag && m.tag.toLowerCase().includes(q)),
		);
	}

	return list;
}

export interface GroupedModels {
	recent: RpcBrowserModel[];
	groups: Array<{
		provider: string;
		models: RpcBrowserModel[];
	}>;
}

/**
 * Group filtered models: "Recent" group first (mruOrder order), then provider groups
 * in the order providers appear in browser.providers.
 */
export function groupPickerModels(models: RpcBrowserModel[], browser: RpcModelBrowserResult | null): GroupedModels {
	if (!browser) {
		return { recent: [], groups: [] };
	}

	const modelBySelector = new Map<string, RpcBrowserModel>();
	const modelByAltKey = new Map<string, RpcBrowserModel>();
	for (const m of models) {
		modelBySelector.set(m.selector, m);
		modelByAltKey.set(`${m.provider}/${m.id}`, m);
	}

	// 1. Recent group: models in mruOrder that passed filters
	const recent: RpcBrowserModel[] = [];
	const recentKeys = new Set<string>();
	if (browser.mruOrder) {
		for (const sel of browser.mruOrder) {
			const m = modelBySelector.get(sel) ?? modelByAltKey.get(sel);
			if (m && !recentKeys.has(m.selector)) {
				recent.push(m);
				recentKeys.add(m.selector);
			}
		}
	}

	// 2. Provider groups in order of browser.providers
	const remainingModelsByProvider = new Map<string, RpcBrowserModel[]>();
	for (const m of models) {
		let list = remainingModelsByProvider.get(m.provider);
		if (!list) {
			list = [];
			remainingModelsByProvider.set(m.provider, list);
		}
		list.push(m);
	}

	const groups: Array<{ provider: string; models: RpcBrowserModel[] }> = [];
	const seenProviders = new Set<string>();

	if (browser.providers) {
		for (const p of browser.providers) {
			const providerModels = remainingModelsByProvider.get(p.id);
			if (providerModels && providerModels.length > 0) {
				groups.push({ provider: p.id, models: providerModels });
				seenProviders.add(p.id);
			}
		}
	}

	// Any providers with models not explicitly listed in browser.providers
	for (const [providerId, providerModels] of remainingModelsByProvider.entries()) {
		if (!seenProviders.has(providerId) && providerModels.length > 0) {
			groups.push({ provider: providerId, models: providerModels });
		}
	}

	return { recent, groups };
}

/**
 * Move highlight index delta with wrapping at both ends.
 */
export function moveHighlight(index: number, delta: number, count: number): number {
	if (count <= 0) return -1;
	if (index < 0) {
		return delta >= 0 ? 0 : count - 1;
	}
	return (index + delta + count) % count;
}

/**
 * Format performance metrics: TPS to 0 decimals, TTFT as ms or s.
 */
export function formatPerf(perf?: RpcModelPerf): { tps: string; ttft: string } | null {
	if (!perf) return null;

	const tps = `${Math.round(perf.tps)} tps`;
	let ttft = "";
	if (perf.ttftMs !== null && perf.ttftMs !== undefined) {
		if (perf.ttftMs >= 1000) {
			const s = (perf.ttftMs / 1000).toFixed(1).replace(/\.0$/, "");
			ttft = `${s}s`;
		} else {
			ttft = `${Math.round(perf.ttftMs)}ms`;
		}
	}

	return { tps, ttft };
}

export function ModelPickerSheet({
	open,
	title,
	browser,
	eligible,
	current,
	mode,
	refreshing,
	onPick,
	onClear,
	onRefresh,
	onClose,
}: ModelPickerSheetProps): ReactNode {
	const [selectedKind, setSelectedKind] = useState("all");
	const [search, setSearch] = useState("");
	const [selectedModel, setSelectedModel] = useState<RpcBrowserModel | null>(null);
	const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
	const [thinkingLevel, setThinkingLevel] = useState<ConfiguredThinkingLevel | undefined>(undefined);
	const [persist, setPersist] = useState(false);
	const [storage, setStorage] = useState<RoleStorage>("project");

	const sheetRef = useRef<HTMLDivElement>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const highlightedRowRef = useRef<HTMLButtonElement>(null);

	// Reset state on open
	useEffect(() => {
		if (open) {
			setSelectedKind("all");
			setSearch("");
			setSelectedModel(null);
			setHighlightedIndex(-1);
			setThinkingLevel(current?.thinkingLevel);
			setPersist(false);
			if (mode.kind === "role") {
				setStorage(mode.storage);
			}
		}
	}, [open, current?.thinkingLevel, mode]);

	// Filtered models
	const filteredModels = useMemo(
		() => filterBrowserModels(browser, { kind: selectedKind, eligible, query: search }),
		[browser, selectedKind, eligible, search],
	);

	// Grouped models
	const { recent, groups } = useMemo(() => groupPickerModels(filteredModels, browser), [filteredModels, browser]);

	// Flat list of selectable models for keyboard navigation and selection
	// Notice: recent models are visually grouped first, followed by provider groups.
	// We build a flat array that maps 1:1 to rendered rows.
	interface RenderedRow {
		key: string;
		model: RpcBrowserModel;
		isRecent: boolean;
	}

	const renderedRows: RenderedRow[] = useMemo(() => {
		const list: RenderedRow[] = [];
		for (const m of recent) {
			list.push({ key: `recent-${m.selector}`, model: m, isRecent: true });
		}
		for (const g of groups) {
			for (const m of g.models) {
				list.push({ key: `${g.provider}-${m.selector}`, model: m, isRecent: false });
			}
		}
		return list;
	}, [recent, groups]);

	// Currently chosen model (either explicitly clicked or matching current prop)
	const chosen = useMemo(() => {
		if (selectedModel) return selectedModel;
		if (!current || !browser?.models) return null;
		return browser.models.find(m => m.provider === current.provider && m.id === current.id) ?? null;
	}, [selectedModel, current, browser?.models]);

	// Keep highlighted row scrolled into view
	useEffect(() => {
		if (highlightedRowRef.current) {
			highlightedRowRef.current.scrollIntoView({ block: "nearest" });
		}
	}, [highlightedIndex]);

	// Provider lookup map for discoverable flag
	const providerMap = useMemo(() => {
		const map = new Map<string, { discoverable: boolean }>();
		if (browser?.providers) {
			for (const p of browser.providers) {
				map.set(p.id, p);
			}
		}
		return map;
	}, [browser?.providers]);

	const handleConfirm = useCallback(
		(modelToPick: RpcBrowserModel | null) => {
			const target = modelToPick ?? chosen;
			if (!target || target.locked) return;

			const selection: PickerSelection = {
				provider: target.provider,
				id: target.id,
				thinkingLevel,
				persist: mode.kind === "agent" ? true : persist,
				storage: mode.kind === "role" && mode.storage === "project" && persist ? storage : undefined,
			};

			onPick(selection);
			onClose();
		},
		[chosen, thinkingLevel, mode, persist, storage, onPick, onClose],
	);

	// Keyboard handler for Esc, ArrowUp/Down, Enter, Tab focus trap, and type-to-search
	useEffect(() => {
		if (!open) return;

		function handleKeyDown(e: KeyboardEvent): void {
			// 1. Esc closes
			if (e.key === "Escape") {
				e.preventDefault();
				onClose();
				return;
			}

			// 2. Arrow keys move highlight
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setHighlightedIndex(idx => moveHighlight(idx, 1, renderedRows.length));
				return;
			}
			if (e.key === "ArrowUp") {
				e.preventDefault();
				setHighlightedIndex(idx => moveHighlight(idx, -1, renderedRows.length));
				return;
			}

			// 3. Enter confirms highlighted or chosen row
			if (e.key === "Enter") {
				e.preventDefault();
				if (highlightedIndex >= 0 && highlightedIndex < renderedRows.length) {
					const target = renderedRows[highlightedIndex].model;
					if (!target.locked) {
						handleConfirm(target);
					}
				} else if (chosen && !chosen.locked) {
					handleConfirm(chosen);
				}
				return;
			}

			// 4. Tab focus trap
			if (e.key === "Tab" && sheetRef.current) {
				const focusable = Array.from(
					sheetRef.current.querySelectorAll(
						'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
					),
				) as HTMLElement[];
				if (focusable.length > 0) {
					const first = focusable[0];
					const last = focusable[focusable.length - 1];
					const active = browserDocument.activeElement as HTMLElement | null;

					if (e.shiftKey) {
						if (!active || active === first || !sheetRef.current.contains(active)) {
							e.preventDefault();
							last.focus();
						}
					} else {
						if (!active || active === last || !sheetRef.current.contains(active)) {
							e.preventDefault();
							first.focus();
						}
					}
				}
				return;
			}

			// 5. Type-to-search: printable character when focus is not in search input
			if (
				e.key.length === 1 &&
				!e.ctrlKey &&
				!e.metaKey &&
				!e.altKey &&
				browserDocument.activeElement !== searchInputRef.current
			) {
				if (searchInputRef.current) {
					searchInputRef.current.focus();
					setSearch(prev => prev + e.key);
					e.preventDefault();
				}
			}
		}

		const win = globalThis as unknown as {
			addEventListener(t: string, fn: (e: KeyboardEvent) => void): void;
			removeEventListener(t: string, fn: (e: KeyboardEvent) => void): void;
		};
		win.addEventListener("keydown", handleKeyDown);
		return () => win.removeEventListener("keydown", handleKeyDown);
	}, [open, onClose, renderedRows, highlightedIndex, chosen, handleConfirm]);

	if (!open) return null;

	const isGlobalRefreshing = refreshing !== null;
	const kinds = browser?.kinds ?? [];
	const showKindTabs = kinds.length > 1;

	let clearLabel: string | null = null;
	if (mode.kind === "role") {
		clearLabel = "Reset to auto";
	} else if (mode.kind === "agent" && mode.agent.override) {
		clearLabel = "Clear override";
	}

	return (
		<>
			<div className="mps-backdrop" onClick={onClose} />
			<div className="mps-sheet" role="dialog" aria-label={title} ref={sheetRef}>
				{/* Header */}
				<div className="mps-header">
					<div className="mps-header-left">
						<span className="mps-title">{title}</span>
					</div>
					<div className="mps-header-actions">
						<button
							type="button"
							className="mps-icon-btn"
							aria-label="Refresh models"
							disabled={isGlobalRefreshing}
							onClick={() => onRefresh()}
						>
							<RotateCw size={16} className={isGlobalRefreshing ? "mps-icon-spin" : undefined} />
						</button>
						<button type="button" className="mps-icon-btn" aria-label="Close" onClick={onClose}>
							<X size={18} />
						</button>
					</div>
				</div>

				{/* Kind tabs */}
				{showKindTabs && (
					<div className="mps-kinds">
						<button
							type="button"
							className={"mps-kind-tab" + (selectedKind === "all" ? " mps-kind-tab--active" : "")}
							onClick={() => setSelectedKind("all")}
						>
							all
						</button>
						{kinds.map(k => (
							<button
								key={k}
								type="button"
								className={"mps-kind-tab" + (selectedKind === k ? " mps-kind-tab--active" : "")}
								onClick={() => setSelectedKind(k)}
							>
								{k}
							</button>
						))}
					</div>
				)}

				{/* Search input (16px to prevent iOS auto-zoom) */}
				<input
					ref={searchInputRef}
					type="text"
					className="mps-search"
					placeholder="Search models..."
					value={search}
					onChange={e => setSearch((e.target as HTMLInputElement).value)}
					autoFocus
				/>

				{/* List */}
				<div className="mps-list">
					{renderedRows.length === 0 && <div className="mps-empty">No models found</div>}

					{/* Recent Group */}
					{recent.length > 0 && (
						<div className="mps-group" data-group="recent">
							<div className="mps-group-header">
								<span className="mps-group-label">Recent</span>
							</div>
							{recent.map(m => {
								const globalIndex = renderedRows.findIndex(r => r.key === `recent-${m.selector}`);
								const isHighlighted = globalIndex === highlightedIndex;
								const isSelected = chosen !== null && chosen.provider === m.provider && chosen.id === m.id;
								const perfData = formatPerf(m.perf);

								return (
									<button
										key={`recent-${m.selector}`}
										ref={isHighlighted ? highlightedRowRef : undefined}
										type="button"
										disabled={m.locked}
										className={
											"mps-row" +
											(isSelected ? " mps-row--selected" : "") +
											(isHighlighted ? " mps-row--highlighted" : "") +
											(m.locked ? " mps-row--dimmed" : "")
										}
										onClick={() => {
											if (!m.locked) {
												setSelectedModel(m);
											}
										}}
									>
										<div className="mps-row-main">
											<div className="mps-row-title-line">
												<span className="mps-row-name">{m.name}</span>
												{m.tag && <span className="mps-tag">{m.tag}</span>}
												{m.locked && (
													<span className="mps-lock-icon" aria-label="locked">
														<Lock size={12} />
													</span>
												)}
											</div>
											<span className="mps-row-id">{m.id}</span>
											{m.roles && m.roles.length > 0 && (
												<div className="mps-role-chips">
													{m.roles.map(r => (
														<span
															key={r.role}
															className={
																"mps-role-chip" +
																(r.auto ? " mps-role-chip--auto" : " mps-role-chip--configured")
															}
														>
															<span
																className={
																	"mps-role-chip-dot " +
																	(r.auto ? "mps-role-chip-dot--hollow" : "mps-role-chip-dot--filled")
																}
															/>
															{r.role}
														</span>
													))}
												</div>
											)}
										</div>

										{perfData && (
											<div className="mps-perf-col">
												<span className="mps-perf-tps">{perfData.tps}</span>
												{perfData.ttft && <span className="mps-perf-ttft">{perfData.ttft}</span>}
											</div>
										)}

										{isSelected && (
											<span className="mps-check" aria-label="selected">
												✓
											</span>
										)}
									</button>
								);
							})}
						</div>
					)}

					{/* Provider Groups */}
					{groups.map(g => {
						const provStatus = providerMap.get(g.provider);
						const isDiscoverable = provStatus?.discoverable === true;
						const isProvRefreshing = refreshing === g.provider || refreshing === "all";

						return (
							<div key={g.provider} className="mps-group" data-provider={g.provider}>
								<div className="mps-group-header">
									<span className="mps-group-label">{g.provider}</span>
									{isDiscoverable && (
										<button
											type="button"
											className="mps-provider-refresh-btn"
											aria-label={`Refresh ${g.provider}`}
											disabled={isProvRefreshing}
											onClick={e => {
												e.stopPropagation();
												onRefresh(g.provider);
											}}
										>
											<RotateCw size={12} className={isProvRefreshing ? "mps-icon-spin" : undefined} />
										</button>
									)}
								</div>

								{g.models.map(m => {
									const globalIndex = renderedRows.findIndex(r => r.key === `${g.provider}-${m.selector}`);
									const isHighlighted = globalIndex === highlightedIndex;
									const isSelected = chosen !== null && chosen.provider === m.provider && chosen.id === m.id;
									const perfData = formatPerf(m.perf);

									return (
										<button
											key={`${g.provider}-${m.selector}`}
											ref={isHighlighted ? highlightedRowRef : undefined}
											type="button"
											disabled={m.locked}
											className={
												"mps-row" +
												(isSelected ? " mps-row--selected" : "") +
												(isHighlighted ? " mps-row--highlighted" : "") +
												(m.locked ? " mps-row--dimmed" : "")
											}
											onClick={() => {
												if (!m.locked) {
													setSelectedModel(m);
												}
											}}
										>
											<div className="mps-row-main">
												<div className="mps-row-title-line">
													<span className="mps-row-name">{m.name}</span>
													{m.tag && <span className="mps-tag">{m.tag}</span>}
													{m.locked && (
														<span className="mps-lock-icon" aria-label="locked">
															<Lock size={12} />
														</span>
													)}
												</div>
												<span className="mps-row-id">{m.id}</span>
												{m.roles && m.roles.length > 0 && (
													<div className="mps-role-chips">
														{m.roles.map(r => (
															<span
																key={r.role}
																className={
																	"mps-role-chip" +
																	(r.auto ? " mps-role-chip--auto" : " mps-role-chip--configured")
																}
															>
																<span
																	className={
																		"mps-role-chip-dot " +
																		(r.auto
																			? "mps-role-chip-dot--hollow"
																			: "mps-role-chip-dot--filled")
																	}
																/>
																{r.role}
															</span>
														))}
													</div>
												)}
											</div>

											{perfData && (
												<div className="mps-perf-col">
													<span className="mps-perf-tps">{perfData.tps}</span>
													{perfData.ttft && <span className="mps-perf-ttft">{perfData.ttft}</span>}
												</div>
											)}

											{isSelected && (
												<span className="mps-check" aria-label="selected">
													✓
												</span>
											)}
										</button>
									);
								})}
							</div>
						);
					})}
				</div>

				{/* Thinking level row (shown for all modes) */}
				<div className="mps-thinking">
					<span className="mps-thinking-label">Thinking</span>
					<div className="mps-thinking-levels">
						{LEVELS.map(level => (
							<button
								key={level}
								type="button"
								className={"mps-level" + (thinkingLevel === level ? " mps-level--active" : "")}
								onClick={() => setThinkingLevel(level)}
							>
								{level}
							</button>
						))}
					</div>
				</div>

				{/* Scope row: mode `active` and `role`: segmented "This session" / "Persist" */}
				{(mode.kind === "active" || mode.kind === "role") && (
					<div className="mps-scope-container">
						<div className="mps-segmented">
							<button
								type="button"
								className={"mps-segmented-btn" + (!persist ? " mps-segmented-btn--active" : "")}
								onClick={() => setPersist(false)}
							>
								This session
							</button>
							<button
								type="button"
								className={"mps-segmented-btn" + (persist ? " mps-segmented-btn--active" : "")}
								onClick={() => setPersist(true)}
							>
								Persist
							</button>
						</div>

						{/* When mode.kind === "role" && mode.storage === "project" and persist is on, a second segmented "Project" / "Global" */}
						{mode.kind === "role" && mode.storage === "project" && persist && (
							<div className="mps-segmented mps-storage-segmented">
								<button
									type="button"
									className={"mps-segmented-btn" + (storage === "project" ? " mps-segmented-btn--active" : "")}
									onClick={() => setStorage("project")}
								>
									Project
								</button>
								<button
									type="button"
									className={"mps-segmented-btn" + (storage === "global" ? " mps-segmented-btn--active" : "")}
									onClick={() => setStorage("global")}
								>
									Global
								</button>
							</div>
						)}
					</div>
				)}

				{/* Actions */}
				<div className="mps-actions">
					{clearLabel && onClear && (
						<button
							type="button"
							className="mps-btn mps-btn--clear"
							onClick={() => {
								onClear();
								onClose();
							}}
						>
							{clearLabel}
						</button>
					)}
					<button
						type="button"
						className="mps-btn mps-btn--confirm"
						disabled={!chosen || chosen.locked}
						onClick={() => handleConfirm(null)}
					>
						Confirm
					</button>
				</div>
			</div>
		</>
	);
}
