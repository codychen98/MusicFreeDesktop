import type { PcloudFetch } from "./pcloud-adapter";

function buildProxyUrl(): string | null {
    try {
        // Lazy require: unit tests run without Electron/webpack aliases.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const AppConfig = require("@shared/app-config/main")
            .default as typeof import("@shared/app-config/main").default;
        const config = AppConfig.getAllConfig();
        if (!config["network.proxy.enabled"]) {
            return null;
        }
        const host = config["network.proxy.host"]?.trim();
        if (!host) {
            return null;
        }
        const url = new URL(host);
        const port = config["network.proxy.port"]?.trim();
        if (port) {
            url.port = port;
        }
        const username = config["network.proxy.username"]?.trim();
        const password = config["network.proxy.password"] ?? "";
        if (username) {
            url.username = username;
        }
        if (password) {
            url.password = password;
        }
        return url.toString();
    } catch {
        return null;
    }
}

export function createPcloudFetch(): PcloudFetch {
    const proxyUrl = buildProxyUrl();
    if (!proxyUrl) {
        return fetch;
    }
    try {
        const { ProxyAgent, fetch: undiciFetch } =
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            require("undici") as typeof import("undici");
        const dispatcher = new ProxyAgent(proxyUrl);
        return (input, init) =>
            undiciFetch(input, {
                ...init,
                dispatcher,
            } as RequestInit);
    } catch {
        return fetch;
    }
}
