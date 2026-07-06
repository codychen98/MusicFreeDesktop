import log from "electron-log/main";
import type { IAppConfig } from "@/types/app-config";
import {
    isPcloudCredentialsCompleteInConfig,
    isWebdavCredentialsCompleteInConfig,
    REMOTE_MUSIC_PLUGIN_PLATFORM,
} from "./remote-config";
import {
    normalizeWebdavRootPath,
    splitWebdavUrlIntoServerAndRoot,
} from "./remote-paths";

export interface LegacyRemoteConfigMigrationContext {
    rawKeys: ReadonlySet<string>;
}

export interface LegacyRemoteConfigMigrationResult {
    patch: IAppConfig;
    migrated: boolean;
}

function trim(value: string | undefined | null): string {
    return value?.trim() ?? "";
}

function getWebdavPluginUserVariables(
    config: IAppConfig,
): Record<string, string> {
    const meta = config["private.pluginMeta"] ?? {};
    return meta[REMOTE_MUSIC_PLUGIN_PLATFORM]?.userVariables ?? {};
}

function shouldMigrateMusicPath(
    config: IAppConfig,
    rawKeys: ReadonlySet<string>,
): boolean {
    if (!rawKeys.has("backup.remote.musicPath")) {
        return true;
    }
    return trim(config["backup.remote.musicPath"]) === "";
}

function buildSyncFlagMigrationPatch(
    config: IAppConfig,
    rawKeys: ReadonlySet<string>,
): IAppConfig {
    const patch: IAppConfig = {};

    if (
        !rawKeys.has("backup.remote.autoSync")
        && rawKeys.has("backup.webdav.autoSync")
    ) {
        patch["backup.remote.autoSync"] = config["backup.webdav.autoSync"];
    }
    if (
        !rawKeys.has("backup.remote.pendingPush")
        && rawKeys.has("backup.webdav.pendingPush")
    ) {
        patch["backup.remote.pendingPush"] = config["backup.webdav.pendingPush"];
    }
    if (
        !rawKeys.has("backup.remote.lastSuccessfulPushAt")
        && rawKeys.has("backup.webdav.lastSuccessfulPushAt")
    ) {
        patch["backup.remote.lastSuccessfulPushAt"] =
            config["backup.webdav.lastSuccessfulPushAt"];
    }

    return patch;
}

function buildWebdavUrlRootMigrationPatch(
    config: IAppConfig,
    rawKeys: ReadonlySet<string>,
): IAppConfig {
    const patch: IAppConfig = {};
    const currentUrl = trim(config["backup.webdav.url"]);
    const currentRoot = normalizeWebdavRootPath(config["backup.webdav.rootPath"]);

    if (currentUrl && !currentRoot) {
        const split = splitWebdavUrlIntoServerAndRoot(currentUrl);
        if (split.rootPath && split.serverUrl !== currentUrl) {
            patch["backup.webdav.url"] = split.serverUrl;
            if (!rawKeys.has("backup.webdav.rootPath") || !currentRoot) {
                patch["backup.webdav.rootPath"] = split.rootPath;
            }
        }
    }

    return patch;
}

/**
 * One-time migration from external WebDAV plugin meta and legacy WebDAV sync keys.
 * Does not write back to plugin meta.
 */
export function buildLegacyRemoteConfigMigration(
    config: IAppConfig,
    context: LegacyRemoteConfigMigrationContext,
): LegacyRemoteConfigMigrationResult {
    const patch: IAppConfig = {};
    const { rawKeys } = context;
    const pluginVars = getWebdavPluginUserVariables(config);

    if (shouldMigrateMusicPath(config, rawKeys)) {
        const searchPath = trim(pluginVars.searchPath);
        if (searchPath) {
            patch["backup.remote.musicPath"] = searchPath;
        }
    }

    if (
        !isPcloudCredentialsCompleteInConfig(config)
        && !isWebdavCredentialsCompleteInConfig(config)
    ) {
        const url = trim(pluginVars.url);
        const username = trim(pluginVars.username);
        const password = trim(pluginVars.password);
        if (url && !trim(config["backup.webdav.url"])) {
            patch["backup.webdav.url"] = url;
        }
        if (username && !trim(config["backup.webdav.username"])) {
            patch["backup.webdav.username"] = username;
        }
        if (password && !trim(config["backup.webdav.password"])) {
            patch["backup.webdav.password"] = password;
        }
    }

    Object.assign(patch, buildSyncFlagMigrationPatch(config, rawKeys));
    Object.assign(patch, buildWebdavUrlRootMigrationPatch(config, rawKeys));

    const migrated = Object.keys(patch).length > 0;
    if (migrated) {
        log.debug("[remote-config] migrated legacy remote storage config", {
            keys: Object.keys(patch),
        });
    }

    return { patch, migrated };
}
