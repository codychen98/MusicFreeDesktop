import AppConfig from "@shared/app-config/renderer";
import PluginManager from "@shared/plugin-manager/renderer";

import { resolveFirstSearchPathSegment } from "@/common/webdav-download-path";

export { resolveFirstSearchPathSegment } from "@/common/webdav-download-path";

export const WEBDAV_MUSIC_PLUGIN_PLATFORM = "WebDAV" as const;

export type DownloadDestination = "local" | "webdav";

export function getWebdavMusicPluginUserVariables(): Record<string, string> {
    const meta = AppConfig.getConfig("private.pluginMeta") ?? {};
    return meta[WEBDAV_MUSIC_PLUGIN_PLATFORM]?.userVariables ?? {};
}

export function isWebdavMusicPluginInstalled(): boolean {
    return Boolean(
        PluginManager.getPluginByPlatform(WEBDAV_MUSIC_PLUGIN_PLATFORM),
    );
}

export function isWebdavDownloadTargetAvailable(): boolean {
    if (!isWebdavMusicPluginInstalled()) {
        return false;
    }
    const vars = getWebdavMusicPluginUserVariables();
    return Boolean(
        vars.url?.trim() &&
            vars.username?.trim() &&
            vars.password?.trim() &&
            vars.searchPath?.trim(),
    );
}

export function getWebdavDownloadTargetSummary(): {
    available: boolean;
    searchPathSegment: string;
    url: string;
} {
    const vars = getWebdavMusicPluginUserVariables();
    return {
        available: isWebdavDownloadTargetAvailable(),
        searchPathSegment: resolveFirstSearchPathSegment(vars.searchPath),
        url: vars.url?.trim() ?? "",
    };
}
