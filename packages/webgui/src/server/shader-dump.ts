import * as os from "node:os";
import * as path from "node:path";

/** Translated shaders run about 40 KB; the cap keeps a stray client from filling the disk. */
const MAX_BYTES = 1 << 20;
/** Patch names from compile-bench.ts joined by `+`; nothing else can reach the file name. */
const NAME = /^[a-z]{1,20}(\+[a-z]{1,20}){0,5}$/;

export function shaderDumpDir(): string {
	return path.join(os.tmpdir(), "webgui-shader-dump");
}

/**
 * `POST /api/shader-dump?name=<variant>`: stores a translated splash shader sent by
 * `/shader?bench=compile&hlsl=1` on a machine whose files we cannot otherwise read.
 */
export async function handleShaderDumpRequest(req: Request, url: URL): Promise<Response | null> {
	if (url.pathname !== "/api/shader-dump") return null;
	if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
	const name = url.searchParams.get("name") ?? "";
	if (!NAME.test(name)) return new Response("bad name", { status: 400 });
	const declared = Number(req.headers.get("content-length") ?? "0");
	if (declared > MAX_BYTES) return new Response("too large", { status: 413 });
	const body = await req.arrayBuffer();
	if (body.byteLength > MAX_BYTES) return new Response("too large", { status: 413 });
	const file = path.join(shaderDumpDir(), `splash-${name}.hlsl.txt`);
	await Bun.write(file, body);
	return Response.json({ path: file, bytes: body.byteLength });
}
