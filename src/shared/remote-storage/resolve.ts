import { isValidPcloudTokenJson } from "./parse-pcloud-token";
import { createWebdavRemoteStorage } from "./webdav-adapter";
import {
    RemoteCredentialsIncompleteError,
    type RemoteStorageClient,
    type RemoteStorageCredentials,
    type RemoteTransport,
    type WebdavCredentials,
} from "./types";

function trim(value: string | undefined): string {
    return value?.trim() ?? "";
}

export function isWebdavCredentialsComplete(
    webdav: Partial<WebdavCredentials> | undefined,
): webdav is WebdavCredentials {
    if (!webdav) {
        return false;
    }
    return Boolean(
        trim(webdav.url) && trim(webdav.username) && trim(webdav.password),
    );
}

export function isPcloudCredentialsComplete(
    pcloud: RemoteStorageCredentials["pcloud"],
): pcloud is NonNullable<RemoteStorageCredentials["pcloud"]> & {
    hostname: string;
    tokenJson: string;
} {
    if (!pcloud) {
        return false;
    }
    const tokenJson = trim(pcloud.tokenJson);
    return Boolean(
        trim(pcloud.hostname) && tokenJson && isValidPcloudTokenJson(tokenJson),
    );
}

function loadWebdavClientFactory(): typeof import("./webdav-client") {
    // Lazy load: webdav npm is ESM-only; defer until a WebDAV client is needed.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./webdav-client") as typeof import("./webdav-client");
}

export function resolveRemoteTransport(
    credentials: RemoteStorageCredentials,
): RemoteTransport | null {
    if (isPcloudCredentialsComplete(credentials.pcloud)) {
        return "pcloud";
    }
    if (isWebdavCredentialsComplete(credentials.webdav)) {
        return "webdav";
    }
    return null;
}

export function createRemoteStorageClientWithTransport(
    credentials: RemoteStorageCredentials,
    transport: RemoteTransport,
): RemoteStorageClient {
    if (transport === "pcloud") {
        const { createPcloudRemoteStorageFromCredentials } =
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            require("./pcloud-client") as typeof import("./pcloud-client");
        const pcloud = credentials.pcloud!;
        return createPcloudRemoteStorageFromCredentials({
            hostname: trim(pcloud.hostname),
            tokenJson: trim(pcloud.tokenJson),
        });
    }
    if (transport === "webdav") {
        const { createWebdavRemoteStorageFromCredentials } =
            loadWebdavClientFactory();
        return createWebdavRemoteStorageFromCredentials({
            url: trim(credentials.webdav!.url),
            rootPath: trim(credentials.webdav!.rootPath ?? ""),
            username: trim(credentials.webdav!.username),
            password: trim(credentials.webdav!.password),
        });
    }
    throw new RemoteCredentialsIncompleteError();
}

export function createRemoteStorageClient(
    credentials: RemoteStorageCredentials,
): RemoteStorageClient {
    const transport = resolveRemoteTransport(credentials);
    if (!transport) {
        throw new RemoteCredentialsIncompleteError();
    }
    return createRemoteStorageClientWithTransport(credentials, transport);
}

export function shouldUseWebdavPlaybackFallback(
    credentials: RemoteStorageCredentials,
): boolean {
    return (
        resolveRemoteTransport(credentials) === "pcloud"
        && isWebdavCredentialsComplete(credentials.webdav)
    );
}

export function createWebdavRemoteStorageClient(
    credentials: WebdavCredentials,
): RemoteStorageClient {
    const { createWebdavRemoteStorageFromCredentials } =
        loadWebdavClientFactory();
    return createWebdavRemoteStorageFromCredentials(credentials);
}

export { createWebdavRemoteStorage };
export type {
    PcloudCredentials,
    RemoteStorageCredentials,
    WebdavCredentials,
} from "./types";
