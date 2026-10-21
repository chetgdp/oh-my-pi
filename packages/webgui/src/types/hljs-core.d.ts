// Stands in for highlight.js's published types (mapped via tsconfig `paths`):
// those `/// <reference lib="dom" />`, which this package deliberately
// excludes. Declares only the surface src/lib/highlight.ts uses.
declare const hljs: {
	getLanguage(name: string): unknown;
	highlight(code: string, options: { language: string; ignoreIllegals?: boolean }): { value: string };
	registerLanguage(name: string, language: (hljs: unknown) => unknown): void;
	newInstance(): typeof hljs;
};
export default hljs;
