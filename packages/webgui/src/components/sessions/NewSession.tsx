import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { SessionListApi } from "../../lib/sessions-api";
import type { DirCompletion } from "../../server/dirs";
import { notify } from "../../lib/notify";
import { shortCwd } from "../../lib/session-groups";

export function NewSession(props: {
	api: SessionListApi;
	recentCwds: readonly string[];
	onAttach(instanceId: string): void;
}): ReactNode {
	const { api, recentCwds, onAttach } = props;
	const [cwd, setCwd] = useState("");
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const abortRef = useRef<AbortController | null>(null);
	// null = list closed. Typing opens it, because phone keyboards have no Tab.
	const [dirs, setDirs] = useState<DirCompletion[] | null>(null);
	const [dirIndex, setDirIndex] = useState(0);
	const dirAbortRef = useRef<AbortController | null>(null);
	const dirTimerRef = useRef<Timer | number | undefined>(undefined);

	useEffect(() => {
		if (cwd === "" && recentCwds.length > 0) {
			setCwd(recentCwds[0]);
		}
	}, [recentCwds]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		return () => {
			abortRef.current?.abort();
			dirAbortRef.current?.abort();
			clearTimeout(dirTimerRef.current);
		};
	}, []);

	const closeDirs = useCallback(() => {
		dirAbortRef.current?.abort();
		clearTimeout(dirTimerRef.current);
		setDirs(null);
	}, []);

	const completeDirs = useCallback(
		async (prefix: string) => {
			dirAbortRef.current?.abort();
			const ac = new AbortController();
			dirAbortRef.current = ac;
			try {
				const found = await api.listDirs(prefix, ac.signal);
				if (ac.signal.aborted) return;
				setDirs(found.length > 0 ? found : null);
				setDirIndex(0);
			} catch {
				if (!ac.signal.aborted) setDirs(null);
			}
		},
		[api],
	);

	// Accepting a directory reopens the list inside it, so Tab walks down the tree.
	const acceptDir = useCallback(
		(dir: DirCompletion) => {
			setCwd(dir.path);
			void completeDirs(dir.path);
		},
		[completeDirs],
	);

	const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>): void => {
		if (e.key === "Tab" && !e.shiftKey) {
			e.preventDefault();
			if (dirs) acceptDir(dirs[dirIndex]!);
			else void completeDirs(cwd);
			return;
		}
		if (!dirs) return;
		if (e.key === "ArrowDown" || e.key === "ArrowUp") {
			e.preventDefault();
			const step = e.key === "ArrowDown" ? 1 : -1;
			setDirIndex(i => (i + step + dirs.length) % dirs.length);
		} else if (e.key === "Enter") {
			e.preventDefault();
			acceptDir(dirs[dirIndex]!);
		} else if (e.key === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			closeDirs();
		}
	};

	const handleStart = useCallback(async () => {
		const trimmed = cwd.trim();
		if (!trimmed || pending) return;
		const ac = new AbortController();
		abortRef.current?.abort();
		abortRef.current = ac;
		setPending(true);
		setError(null);

		try {
			const result = await api.launch(trimmed, ac.signal);
			if (ac.signal.aborted) return;

			setPending(false);
			onAttach(result.instanceId);
		} catch (err: unknown) {
			if (ac.signal.aborted) return;
			setPending(false);
			const message = err instanceof Error ? err.message : String(err);
			setError(message);
			notify("error", message);
		}
	}, [api, cwd, pending, onAttach]);

	const current = cwd.trim();
	const needleLength = cwd.length - cwd.lastIndexOf("/") - 1;

	return (
		<div className="ses-new-form">
			<h4 className="ses-new-form-title">New session</h4>
			<div>
				<input
					type="text"
					className="ses-cwd-input"
					value={cwd}
					placeholder="Working directory"
					autoCapitalize="off"
					autoCorrect="off"
					spellCheck={false}
					role="combobox"
					aria-expanded={dirs !== null}
					aria-controls="ses-dir-popup"
					onKeyDown={handleKeyDown}
					onBlur={closeDirs}
					onChange={e => {
						const target = e.target;
						if (target && typeof target === "object" && "value" in target) {
							const value = target.value as string;
							setCwd(value);
							clearTimeout(dirTimerRef.current);
							dirTimerRef.current = setTimeout(() => void completeDirs(value), 100);
						}
					}}
					disabled={pending}
				/>
				{dirs !== null && (
					<ul id="ses-dir-popup" className="ses-recent-cwds ses-dir-popup" role="listbox" aria-label="Folders">
						{dirs.map((d, i) => (
							<li
								key={d.path}
								role="option"
								aria-selected={i === dirIndex}
								className={`ses-recent-cwd ses-dir-option${i === dirIndex ? " ses-recent-cwd--selected" : ""}`}
								// mousedown, not click: click fires after the input's blur closes the list.
								onMouseDown={e => {
									e.preventDefault();
									acceptDir(d);
								}}
							>
								<strong>{d.name.slice(0, needleLength)}</strong>
								{d.name.slice(needleLength)}/
							</li>
						))}
					</ul>
				)}
			</div>
			{dirs === null && recentCwds.length > 0 && (
				<div className="ses-recent-cwds" role="listbox" aria-label="Recent folders">
					{recentCwds.map(c => (
						<button
							key={c}
							type="button"
							role="option"
							aria-selected={c === current}
							className={`ses-recent-cwd${c === current ? " ses-recent-cwd--selected" : ""}`}
							onClick={() => setCwd(c)}
							disabled={pending}
							title={c}
						>
							{shortCwd(c)}
						</button>
					))}
				</div>
			)}
			<button type="button" className="ses-start-btn" onClick={handleStart} disabled={pending || !cwd.trim()}>
				{pending ? "Starting..." : "Start"}
			</button>
			{error != null && <p className="ses-new-error">{error}</p>}
			{pending && <p className="ses-new-pending">Waiting for session to appear...</p>}
		</div>
	);
}
