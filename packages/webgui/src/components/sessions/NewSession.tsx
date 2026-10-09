import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { SessionListApi } from "../../lib/sessions-api";
import { notify } from "../../lib/notify";

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

	useEffect(() => {
		if (cwd === "" && recentCwds.length > 0) {
			setCwd(recentCwds[0]);
		}
	}, [recentCwds]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		return () => {
			abortRef.current?.abort();
		};
	}, []);

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

	const datalistId = "ses-recent-cwds";

	return (
		<div className="ses-new-form">
			<h4 className="ses-new-form-title">New session</h4>
			<input
				type="text"
				className="ses-cwd-input"
				value={cwd}
				placeholder="Working directory"
				list={datalistId}
				onChange={e => {
					const target = e.target;
					if (target && typeof target === "object" && "value" in target) {
						setCwd(target.value as string);
					}
				}}
				disabled={pending}
			/>
			<datalist id={datalistId}>
				{recentCwds.map(c => (
					<option key={c} value={c} />
				))}
			</datalist>
			<button type="button" className="ses-start-btn" onClick={handleStart} disabled={pending || !cwd.trim()}>
				{pending ? "Starting..." : "Start"}
			</button>
			{error != null && <p className="ses-new-error">{error}</p>}
			{pending && <p className="ses-new-pending">Waiting for session to appear...</p>}
		</div>
	);
}
