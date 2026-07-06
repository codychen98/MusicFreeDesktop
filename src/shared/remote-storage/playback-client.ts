import AppConfig from "@shared/app-config/main";
import { getRemoteMusicClient } from "@shared/webdav-music-upload/upload-impl";

import {
    getRemoteStorageCredentialsFromConfig,
    isWebdavCredentialsCompleteInConfig,
} from "./remote-config";
import {
    createWebdavRemoteStorageClient,
    shouldUseWebdavPlaybackFallback,
} from "./resolve";
import type { RemoteStorageClient } from "./types";

let cachedWebdavFallbackClient: RemoteStorageClient | null = null;
let cachedWebdavFallbackKey = "";

function getWebdavFallbackClient(): RemoteStorageClient | null {
    const config = AppConfig.getAllConfig();
    if (!isWebdavCredentialsCompleteInConfig(config)) {
        return null;
    }
    const creds = getRemoteStorageCredentialsFromConfig(config);
    const webdav = creds.webdav!;
    const key = `webdav\0${webdav.url}\0${webdav.rootPath ?? ""}\0${webdav.username}\0${webdav.password}`;
    if (cachedWebdavFallbackClient && cachedWebdavFallbackKey === key) {
        return cachedWebdavFallbackClient;
    }
    cachedWebdavFallbackClient = createWebdavRemoteStorageClient({
        url: webdav.url.trim(),
        rootPath: webdav.rootPath?.trim() ?? "",
        username: webdav.username.trim(),
        password: webdav.password.trim(),
    });
    cachedWebdavFallbackKey = key;
    return cachedWebdavFallbackClient;
}

function isWebdavPlaybackFallbackActive(): boolean {
    const config = AppConfig.getAllConfig();
    return shouldUseWebdavPlaybackFallback(
        getRemoteStorageCredentialsFromConfig(config),
    );
}

async function withPlaybackFallback<T>(
    primaryOp: (client: RemoteStorageClient) => Promise<T>,
    fallbackOp: (client: RemoteStorageClient) => Promise<T>,
    shouldFallback: (result: T) => boolean = () => false,
): Promise<T> {
    let primary: RemoteStorageClient;
    try {
        primary = await getRemoteMusicClient();
    } catch (primaryError) {
        if (!isWebdavPlaybackFallbackActive()) {
            throw primaryError;
        }
        const fallback = getWebdavFallbackClient();
        if (!fallback) {
            throw primaryError;
        }
        return fallbackOp(fallback);
    }

    try {
        const result = await primaryOp(primary);
        if (!shouldFallback(result)) {
            return result;
        }
        if (!isWebdavPlaybackFallbackActive()) {
            return result;
        }
        const fallback = getWebdavFallbackClient();
        if (!fallback) {
            return result;
        }
        return fallbackOp(fallback);
    } catch (primaryError) {
        if (!isWebdavPlaybackFallbackActive()) {
            throw primaryError;
        }
        const fallback = getWebdavFallbackClient();
        if (!fallback) {
            throw primaryError;
        }
        return fallbackOp(fallback);
    }
}

export async function remoteExistsForPlayback(path: string): Promise<boolean> {
    const normalized = path?.trim();
    if (!normalized) {
        return false;
    }
    return withPlaybackFallback(
        (client) => client.exists(normalized),
        (client) => client.exists(normalized),
        (exists) => !exists,
    );
}

export async function getRemoteTextForPlayback(path: string): Promise<string> {
    const normalized = path?.trim();
    if (!normalized) {
        throw new Error("REMOTE_PATH_MISSING");
    }
    return withPlaybackFallback(
        (client) => client.getText(normalized),
        (client) => client.getText(normalized),
    );
}

export async function getRemoteDownloadUrl(path: string): Promise<string> {
    const normalized = path?.trim();
    if (!normalized) {
        throw new Error("REMOTE_PATH_MISSING");
    }
    return withPlaybackFallback(
        (client) => client.getDownloadUrl(normalized),
        (client) => client.getDownloadUrl(normalized),
    );
}
