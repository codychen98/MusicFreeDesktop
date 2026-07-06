import {
    buildLegacyRemoteConfigMigration,
} from "../../shared/remote-storage/migrate-legacy-config";
import {
    getRemoteAutoSync,
    getRemoteMusicPath,
    getRemotePendingPush,
    isWebdavCredentialsCompleteInConfig,
    normalizeRemoteConfigPatch,
} from "../../shared/remote-storage/remote-config";
import type { IAppConfig } from "@/types/app-config";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function rawKeysOf(config: IAppConfig): Set<string> {
    return new Set(Object.keys(config));
}

function testFreshInstallNoMigration(): void {
    const config: IAppConfig = {
        "backup.webdav.url": "",
        "backup.webdav.username": "",
        "backup.webdav.password": "",
    };
    const result = buildLegacyRemoteConfigMigration(config, {
        rawKeys: rawKeysOf(config),
    });
    assert(!result.migrated, "fresh install should not migrate");
    assert(
        Object.keys(result.patch).length === 0,
        "fresh install should produce empty patch",
    );
}

function testPluginSearchPathToMusicPath(): void {
    const config: IAppConfig = {
        "private.pluginMeta": {
            WebDAV: {
                userVariables: {
                    searchPath: "/Music/Download",
                    url: "https://dav.example.com",
                    username: "user",
                    password: "pass",
                },
            },
        },
    };
    const result = buildLegacyRemoteConfigMigration(config, {
        rawKeys: rawKeysOf(config),
    });
    assert(result.migrated, "should migrate searchPath");
    assert(
        result.patch["backup.remote.musicPath"] === "/Music/Download",
        "searchPath copied to musicPath",
    );
}

function testPluginCredsToWebdavWhenIncomplete(): void {
    const config: IAppConfig = {
        "private.pluginMeta": {
            WebDAV: {
                userVariables: {
                    url: "https://dav.example.com",
                    username: "alice",
                    password: "secret",
                },
            },
        },
    };
    const result = buildLegacyRemoteConfigMigration(config, {
        rawKeys: rawKeysOf(config),
    });
    assert(result.migrated, "should migrate webdav creds");
    assert(
        result.patch["backup.webdav.url"] === "https://dav.example.com",
        "url copied",
    );
    assert(
        result.patch["backup.webdav.username"] === "alice",
        "username copied",
    );
    assert(
        result.patch["backup.webdav.password"] === "secret",
        "password copied",
    );
}

function testSkipsWebdavCredsWhenPcloudComplete(): void {
    const config: IAppConfig = {
        "backup.remote.pcloud.tokenJson": "{\"access_token\":\"tok\",\"token_type\":\"bearer\"}",
        "private.pluginMeta": {
            WebDAV: {
                userVariables: {
                    url: "https://dav.example.com",
                    username: "alice",
                    password: "secret",
                },
            },
        },
    };
    const result = buildLegacyRemoteConfigMigration(config, {
        rawKeys: rawKeysOf(config),
    });
    assert(
        result.patch["backup.webdav.url"] === undefined,
        "should not copy webdav url when pcloud is configured",
    );
}

function testDoesNotOverwriteExistingMusicPath(): void {
    const config: IAppConfig = {
        "backup.remote.musicPath": "/existing/path",
        "private.pluginMeta": {
            WebDAV: {
                userVariables: {
                    searchPath: "/plugin/path",
                },
            },
        },
    };
    const result = buildLegacyRemoteConfigMigration(config, {
        rawKeys: rawKeysOf(config),
    });
    assert(
        result.patch["backup.remote.musicPath"] === undefined,
        "existing musicPath must not be overwritten",
    );
}

function testSyncFlagsMigratedFromWebdavKeys(): void {
    const config: IAppConfig = {
        "backup.webdav.autoSync": true,
        "backup.webdav.pendingPush": true,
        "backup.webdav.lastSuccessfulPushAt": 12345,
    };
    const result = buildLegacyRemoteConfigMigration(config, {
        rawKeys: rawKeysOf(config),
    });
    assert(result.patch["backup.remote.autoSync"] === true, "autoSync migrated");
    assert(result.patch["backup.remote.pendingPush"] === true, "pendingPush migrated");
    assert(
        result.patch["backup.remote.lastSuccessfulPushAt"] === 12345,
        "lastSuccessfulPushAt migrated",
    );
}

function testRemoteSyncShimReadsLegacyKeys(): void {
    const config: IAppConfig = {
        "backup.webdav.autoSync": true,
        "backup.webdav.pendingPush": true,
    };
    assert(getRemoteAutoSync(config) === true, "shim reads webdav autoSync");
    assert(getRemotePendingPush(config) === true, "shim reads webdav pendingPush");
}

function testNormalizePatchMirrorsLegacySyncWrites(): void {
    const patch = normalizeRemoteConfigPatch({
        "backup.webdav.autoSync": true,
        "backup.webdav.pendingPush": true,
    });
    assert(patch["backup.remote.autoSync"] === true, "mirrors autoSync");
    assert(patch["backup.remote.pendingPush"] === true, "mirrors pendingPush");
}

function testNormalizePatchClearsPendingWhenAutoSyncOff(): void {
    const patch = normalizeRemoteConfigPatch({
        "backup.remote.autoSync": false,
        "backup.remote.pendingPush": true,
    });
    assert(patch["backup.remote.pendingPush"] === false, "clears pending push");
}

function testWebdavCompleteAfterMigration(): void {
    const config: IAppConfig = {
        "backup.webdav.url": "https://dav.example.com",
        "backup.webdav.username": "alice",
        "backup.webdav.password": "secret",
    };
    assert(
        isWebdavCredentialsCompleteInConfig(config),
        "webdav creds complete",
    );
    assert(
        getRemoteMusicPath({ ...config, "backup.remote.musicPath": "/a" })
            === "/a",
        "music path helper trims",
    );
}

function run(): void {
    testFreshInstallNoMigration();
    testPluginSearchPathToMusicPath();
    testPluginCredsToWebdavWhenIncomplete();
    testSkipsWebdavCredsWhenPcloudComplete();
    testDoesNotOverwriteExistingMusicPath();
    testSyncFlagsMigratedFromWebdavKeys();
    testRemoteSyncShimReadsLegacyKeys();
    testNormalizePatchMirrorsLegacySyncWrites();
    testNormalizePatchClearsPendingWhenAutoSyncOff();
    testWebdavCompleteAfterMigration();
}

run();
