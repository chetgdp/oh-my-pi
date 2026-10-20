import { createServerOperator } from "../src/lib/servers";
import type { ServerOperator } from "../src/lib/servers";
import type { SessionListApi } from "../src/lib/sessions-api";

/** Operator with only the implicit `local` server, backed by `api`. */
export function localServers(api: SessionListApi): ServerOperator {
	return createServerOperator({ storage: null, origin: "http://localhost:3000", createApi: () => api });
}
