import { parsePcloudTokenJson } from "./parse-pcloud-token";
import { createPcloudRemoteStorage } from "./pcloud-adapter";
import { createPcloudFetch } from "./pcloud-fetch";
import type { PcloudCredentials , RemoteStorageClient } from "./types";

export function createPcloudRemoteStorageFromCredentials(
    credentials: PcloudCredentials,
): RemoteStorageClient {
    const { accessToken } = parsePcloudTokenJson(credentials.tokenJson);
    return createPcloudRemoteStorage({
        hostname: credentials.hostname,
        accessToken,
        fetch: createPcloudFetch(),
    });
}
