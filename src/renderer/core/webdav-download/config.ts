import AppConfig from "@shared/app-config/renderer";
import {
    getRemoteMusicPath,
    getRemoteStorageCredentialsFromConfig,
    isRemoteMusicAvailableInConfig,
} from "@shared/remote-storage/remote-config";
import { resolveRemoteTransport } from "@shared/remote-storage/resolve";

import { resolveFirstSearchPathSegment } from "@/common/webdav-download-path";

export { resolveFirstSearchPathSegment } from "@/common/webdav-download-path";

export const WEBDAV_MUSIC_PLUGIN_PLATFORM = "WebDAV" as const;

export type DownloadDestination = "local" | "webdav";

export function isRemoteMusicAvailable(): boolean {
    return isRemoteMusicAvailableInConfig(AppConfig.getAllConfig());
}

export function isRemoteDownloadTargetAvailable(): boolean {
    return isRemoteMusicAvailable();
}

export function isWebdavDownloadTargetAvailable(): boolean {
    return isRemoteMusicAvailable();
}

export function getRemoteDownloadTargetSummary(): {
    available: boolean;
    searchPathSegment: string;
    url: string;
} {
    const config = AppConfig.getAllConfig();
    const musicPath = getRemoteMusicPath(config);
    const creds = getRemoteStorageCredentialsFromConfig(config);
    const transport = resolveRemoteTransport(creds);
    const url =
        transport === "webdav"
            ? (creds.webdav?.url?.trim() ?? "")
            : transport === "pcloud"
                ? (creds.pcloud?.hostname?.trim() ?? "")
                : "";
    return {
        available: isRemoteMusicAvailableInConfig(config),
        searchPathSegment: resolveFirstSearchPathSegment(musicPath),
        url,
    };
}

export function getWebdavDownloadTargetSummary(): {
    available: boolean;
    searchPathSegment: string;
    url: string;
} {
    return getRemoteDownloadTargetSummary();
}
