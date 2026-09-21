// Unified dev server: starts the Bun HTML dev server (HMR) and the
// backend (API + WS) on a separate port.

import { resolve } from "node:path";
import { spawn, type Subprocess } from "bun";

const PKG_ROOT = resolve(import.meta.dir, "../..");
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT) || 5173;
const BACKEND_PORT = Number(process.env.PORT) || 8081;

const children: Subprocess[] = [];

function launch(label: string, cmd: string[], env?: Record<string, string>): Subprocess {
	const child = spawn(cmd, {
		cwd: PKG_ROOT,
		stdout: "inherit",
		stderr: "inherit",
		stdin: "inherit",
		env: { ...process.env, ...env },
	});
	children.push(child);
	child.exited.then(code => {
		console.log(`[dev] ${label} exited (${code})`);
		shutdown();
	});
	return child;
}

function shutdown() {
	for (const child of children) {
		try {
			child.kill();
		} catch {}
	}
	process.exit();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Frontend: Bun HTML dev server with HMR
launch("frontend", ["bun", "./index.html", `--port=${FRONTEND_PORT}`]);

// Backend: API + WebSocket server (no --watch; restart loses session state)
launch("backend", ["bun", "src/server/index.ts"], {
	PORT: String(BACKEND_PORT),
	OMP_DEV_ORIGIN: `http://localhost:${FRONTEND_PORT}`,
});

console.log(`[dev] Frontend (HMR):  http://localhost:${FRONTEND_PORT}`);
console.log(`[dev] Backend (API+WS): http://localhost:${BACKEND_PORT}`);
