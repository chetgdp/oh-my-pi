// Static prototype server. Nothing here is wired to omp.
const dir = import.meta.dir;
Bun.serve({
	hostname: "127.0.0.1",
	port: 8083,
	async fetch(req) {
		const name = new URL(req.url).pathname.replace(/^\/+/, "") || "index.html";
		if (name.includes("..")) return new Response("no", { status: 400 });
		const file = Bun.file(`${dir}/${name}`);
		if (!(await file.exists())) return new Response("not found", { status: 404 });
		return new Response(file, { headers: { "cache-control": "no-store" } });
	},
});
console.log("prototypes on http://127.0.0.1:8083");
