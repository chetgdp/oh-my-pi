# packages/shell
## Lazy imports
Exception to the root rule "NEVER use inline imports": every `?` is a new process, so startup time is user-visible. A lazy `await import()` is allowed for a module that only some commands need (native addons, heavy render helpers). A nearby comment must name the command that needs it and why. Type-position `import("pkg").Type` stays banned.
