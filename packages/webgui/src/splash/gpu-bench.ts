/**
 * `/shader?bench=gpu`: times the WebGPU compile of the WGSL port of the main
 * scene shader (`wgsl/main.wgsl`), to compare with the WebGL link time that
 * `?bench=compile` measures (30 s on ANGLE/D3D11/FXC). Rows: `cold` uses a
 * fresh nonce, `repeat` the previous row's nonce (cache hit expected).
 * `?n=` sets the number of cold rows (default 3).
 */
import { browserDocument, browserWindow } from "../lib/dom";
import { BUF_COPY_DST, BUF_UNIFORM, type Gpu, type GpuDevice, TEX_ATTACHMENT, TEX_BINDING } from "./gpu";
import MAIN_WGSL from "./wgsl/main.wgsl" with { type: "text" };

const SIZE = 64;
/** Shifted by a whole number per row; see compile-bench.ts NONCE_LITERAL (float32 spacing at 43758 is ~.004). */
const NONCE_LITERAL = "43758.5453";

interface Row {
	name: string;
	module: string;
	pipeline: string;
	draw: string;
}

/** Same uniforms as compile-bench.ts: a view across the gate plane with every portal branch on. */
function uniforms(): Float32Array {
	// U layout in main.wgsl: 6 x (vec3 + f32), SP, MP, R, P = 36 floats
	const u = new Float32Array(36);
	u[7] = 33; // L
	u[11] = 1; // D
	u[15] = 400; // F
	u[19] = -2; // CZ
	u.set([SIZE, SIZE, 1, 1], 32); // R, P
	return u;
}

async function timeVariant(device: GpuDevice, nonce: number): Promise<Omit<Row, "name">> {
	const code = MAIN_WGSL.replaceAll(NONCE_LITERAL, `${43758 + nonce}.5453`);
	const t0 = performance.now();
	const module = device.createShaderModule({ code });
	const errors = (await module.getCompilationInfo()).messages.filter(m => m.type === "error");
	if (errors.length > 0)
		throw new Error(
			errors
				.map(m => `${m.lineNum}: ${m.message}`)
				.join("; ")
				.slice(0, 300),
		);
	const t1 = performance.now();
	const pipeline = await device.createRenderPipelineAsync({
		layout: "auto",
		vertex: { module, entryPoint: "vs" },
		fragment: { module, entryPoint: "fs", targets: [{ format: "rgba8unorm" }] },
		primitive: { topology: "triangle-list" },
	});
	const t2 = performance.now();
	const target = device.createTexture({ size: [SIZE, SIZE], format: "rgba8unorm", usage: TEX_ATTACHMENT });
	const g = [0, 1].map(() => device.createTexture({ size: [SIZE, SIZE], format: "rgba16float", usage: TEX_BINDING }));
	const ubuf = device.createBuffer({ size: 144, usage: BUF_UNIFORM | BUF_COPY_DST });
	try {
		device.queue.writeBuffer(ubuf, 0, uniforms());
		const bind = device.createBindGroup({
			layout: pipeline.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: { buffer: ubuf } },
				{ binding: 1, resource: g[0].createView() },
				{ binding: 2, resource: g[1].createView() },
			],
		});
		const enc = device.createCommandEncoder();
		const pass = enc.beginRenderPass({
			colorAttachments: [{ view: target.createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }],
		});
		pass.setPipeline(pipeline);
		pass.setBindGroup(0, bind);
		pass.draw(3);
		pass.end();
		device.queue.submit([enc.finish()]);
		await device.queue.onSubmittedWorkDone();
	} finally {
		target.destroy();
		for (const t of g) t.destroy();
		ubuf.destroy();
	}
	const t3 = performance.now();
	return { module: (t1 - t0).toFixed(0), pipeline: (t2 - t1).toFixed(0), draw: (t3 - t2).toFixed(0) };
}

/** Mount the bench over the page body; called from main.tsx on `/shader?bench=gpu`. */
export async function startGpuBench(): Promise<void> {
	const root = browserDocument.getElementById("root") as unknown as { style: { display: string } } | null;
	if (root) root.style.display = "none";
	const out = browserDocument.createElement("pre") as unknown as {
		style: { cssText: string };
		textContent: string;
	};
	out.style.cssText = "margin:12px;color:#eee;background:#111;font:13px ui-monospace,monospace;white-space:pre-wrap";
	browserDocument.body.appendChild(out);
	const head = [`${browserWindow.navigator.userAgent}`];
	const rows: Row[] = [];
	const render = (status: string) => {
		out.textContent = [
			...head,
			"",
			`${"row".padEnd(12)} ${"module ms".padStart(10)} ${"pipeline ms".padStart(12)} ${"draw ms".padStart(10)}`,
			...rows.map(
				r => `${r.name.padEnd(12)} ${r.module.padStart(10)} ${r.pipeline.padStart(12)} ${r.draw.padStart(10)}`,
			),
			"",
			status,
		].join("\n");
	};
	// WebGPU is outside the narrow BrowserNavigator type (no DOM lib); presence is checked right below
	const nav = browserWindow.navigator as { gpu?: Gpu };
	const gpu = nav.gpu;
	if (!gpu) {
		render("navigator.gpu unavailable: no WebGPU in this browser/context");
		return;
	}
	const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
	if (!adapter) {
		render("requestAdapter returned null");
		return;
	}
	// GPUAdapterInfo fields are prototype getters (JSON.stringify gives {}); Brave blanks them
	const info = adapter.info ?? {};
	const desc = ["vendor", "architecture", "device", "description"].map(k => `${k}=${String(info[k] ?? "")}`);
	head.push(`adapter ${desc.join(" ")} fallback ${String(adapter.isFallbackAdapter ?? "?")}`);
	head.push(`features ${[...adapter.features].sort().join(" ")}`);
	const device = await adapter.requestDevice();
	// whole-number offsets stay exact in float32 below 2^24
	const nonce = Math.floor(Math.random() * 1e4) * 100;
	head.push(`nonce ${nonce}`);
	const cold = Math.max(1, Number(new URLSearchParams(browserWindow.location.search).get("n")) || 3);
	const run = async (name: string, n: number) => {
		render(`running ${name} ...`);
		try {
			rows.push({ name, ...(await timeVariant(device, n)) });
		} catch (err) {
			rows.push({ name, module: err instanceof Error ? err.message : String(err), pipeline: "", draw: "" });
		}
	};
	try {
		for (let i = 1; i <= cold; i++) {
			await run(`cold ${i}`, nonce + i);
			await run(`repeat ${i}`, nonce + i);
		}
	} finally {
		device.destroy();
	}
	render("done");
}
