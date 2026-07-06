import type { IAppConfig } from "@/types/app-config";
import { resolveFirstSearchPathSegment } from "../../common/webdav-download-path";
import {
    normalizeWebdavRootPath,
    normalizeWebdavServerUrl,
    splitWebdavUrlIntoServerAndRoot,
} from "./remote-paths";
import { isValidPcloudTokenJson } from "./parse-pcloud-token";
import { resolveRemoteTransport } from "./resolve";
import type { RemoteStorageCredentials } from "./types";

export const REMOTE_MUSIC_PLUGIN_PLATFORM = "WebDAV" as const;

const DEFAULT_PCLOUD_HOSTNAME = "api.pcloud.com";

function trim(value: string | undefined | null): string {
    return value?.trim() ?? "";
}

export function isWebdavCredentialsCompleteInConfig(
    config: IAppConfig,
): boolean {
    return Boolean(
        trim(config["backup.webdav.url"])
            && trim(config["backup.webdav.username"])
            && trim(config["backup.webdav.password"]),
    );
}

export function isPcloudCredentialsCompleteInConfig(
    config: IAppConfig,
): boolean {
    const tokenJson = trim(config["backup.remote.pcloud.tokenJson"]);
    return Boolean(
        trim(config["backup.remote.pcloud.hostname"] ?? DEFAULT_PCLOUD_HOSTNAME)
            && tokenJson
            && isValidPcloudTokenJson(tokenJson),
    );
}

export function isPcloudTokenFieldPresentButInvalidInConfig(
    config: IAppConfig,
): boolean {
    const tokenJson = trim(config["backup.remote.pcloud.tokenJson"]);
    return Boolean(tokenJson && !isValidPcloudTokenJson(tokenJson));
}

export function isRemoteCredentialsCompleteInConfig(
    config: IAppConfig,
): boolean {
    return (
        resolveRemoteTransport(getRemoteStorageCredentialsFromConfig(config))
        !== null
    );
}

export function getWebdavRootPath(config: IAppConfig): string {
    return normalizeWebdavRootPath(config["backup.webdav.rootPath"]);
}

export function getRemoteStorageCredentialsFromConfig(
    config: IAppConfig,
): RemoteStorageCredentials {
    return {
        webdav: {
            url: normalizeWebdavServerUrl(config["backup.webdav.url"] ?? ""),
            rootPath: getWebdavRootPath(config),
            username: config["backup.webdav.username"] ?? "",
            password: config["backup.webdav.password"] ?? "",
        },
        pcloud: {
            hostname:
                config["backup.remote.pcloud.hostname"] ?? DEFAULT_PCLOUD_HOSTNAME,
            tokenJson: config["backup.remote.pcloud.tokenJson"] ?? "",
        },
    };
}

export function getRemoteMusicPath(config: IAppConfig): string {
    return trim(config["backup.remote.musicPath"]);
}

export function isRemoteMusicAvailableInConfig(config: IAppConfig): boolean {
    if (!isRemoteCredentialsCompleteInConfig(config)) {
        return false;
    }
    return Boolean(resolveFirstSearchPathSegment(getRemoteMusicPath(config)));
}

/** Prefer unified remote sync keys; fall back to legacy WebDAV keys. */
export function getRemoteAutoSync(config: IAppConfig): boolean {
    const remote = config["backup.remote.autoSync"];
    if (remote !== undefined && remote !== null) {
        return remote === true;
    }
    return config["backup.webdav.autoSync"] === true;
}

export function getRemotePendingPush(config: IAppConfig): boolean {
    const remote = config["backup.remote.pendingPush"];
    if (remote !== undefined && remote !== null) {
        return remote === true;
    }
    return config["backup.webdav.pendingPush"] === true;
}

export function getRemoteLastSuccessfulPushAt(
    config: IAppConfig,
): number | null | undefined {
    const remote = config["backup.remote.lastSuccessfulPushAt"];
    if (remote !== undefined && remote !== null) {
        return remote;
    }
    return config["backup.webdav.lastSuccessfulPushAt"];
}

/**
 * Mirror legacy WebDAV sync writes into unified remote keys and clear pending
 * push when auto-sync is turned off.
 */
export function normalizeRemoteConfigPatch(patch: IAppConfig): IAppConfig {
    const result: IAppConfig = { ...patch };

    if (
        "backup.webdav.autoSync" in result
        && !("backup.remote.autoSync" in result)
    ) {
        result["backup.remote.autoSync"] = result["backup.webdav.autoSync"];
    }
    if (
        "backup.webdav.pendingPush" in result
        && !("backup.remote.pendingPush" in result)
    ) {
        result["backup.remote.pendingPush"] = result["backup.webdav.pendingPush"];
    }
    if (
        "backup.webdav.lastSuccessfulPushAt" in result
        && !("backup.remote.lastSuccessfulPushAt" in result)
    ) {
        result["backup.remote.lastSuccessfulPushAt"] =
            result["backup.webdav.lastSuccessfulPushAt"];
    }

    if (result["backup.remote.autoSync"] === false) {
        result["backup.remote.pendingPush"] = false;
    }
    if (result["backup.webdav.autoSync"] === false) {
        result["backup.webdav.pendingPush"] = false;
    }

    if ("backup.webdav.rootPath" in result) {
        result["backup.webdav.rootPath"] = normalizeWebdavRootPath(
            result["backup.webdav.rootPath"],
        );
    }
    if ("backup.webdav.url" in result) {
        const split = splitWebdavUrlIntoServerAndRoot(
            result["backup.webdav.url"] ?? "",
        );
        result["backup.webdav.url"] = split.serverUrl;
        if (
            split.rootPath
            && !normalizeWebdavRootPath(result["backup.webdav.rootPath"])
        ) {
            result["backup.webdav.rootPath"] = split.rootPath;
        }
    }

    return result;
}
