import { actualRelayHeaders } from "@oh-my-pi/pi-catalog/provider-models/actual";
import type { ProviderTransport } from "./build";

/** `ACTUAL_CLUSTER_ID` routes relay inference to one of the key owner's clusters. */
export const actualRelayTransport: ProviderTransport = {
	prepareRequest: (model, options) => {
		const clusterHeaders = actualRelayHeaders();
		if (!("X-Cluster-ID" in clusterHeaders)) return { model, options };
		return { model, options: { ...options, headers: { ...clusterHeaders, ...options.headers } } };
	},
};
