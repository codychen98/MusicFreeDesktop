import { AuthType, createClient, type WebDAVClient } from "webdav";

import { createWebdavRemoteStorage } from "./webdav-adapter";
import type { RemoteStorageClient , WebdavCredentials } from "./types";

export function createWebdavClient(credentials: WebdavCredentials): WebDAVClient {
    return createClient(credentials.url, {
        authType: AuthType.Password,
        username: credentials.username,
        password: credentials.password,
    });
}

export function createWebdavRemoteStorageFromCredentials(
    credentials: WebdavCredentials,
): RemoteStorageClient {
    return createWebdavRemoteStorage(createWebdavClient(credentials));
}
