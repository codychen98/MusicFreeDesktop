import {
    getRemoteBackupPaths,
    normalizeWebdavRootPath,
    normalizeWebdavServerUrl,
    resolveRemoteAbsolutePath,
    splitWebdavUrlIntoServerAndRoot,
} from "../../shared/remote-storage/remote-paths";
import { buildLegacyRemoteConfigMigration } from "../../shared/remote-storage/migrate-legacy-config";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function runPathTests(): void {
    assert(
        normalizeWebdavServerUrl(
            "https://webdav.pcloud.com/(Reinstall)\\BACKUP\\",
        ) === "https://webdav.pcloud.com/",
        "pCloud server URL normalizes to host root",
    );
    assert(
        normalizeWebdavRootPath("(Reinstall)\\BACKUP\\")
            === "/(Reinstall)/BACKUP",
        "root path normalizes slashes and leading slash",
    );
    assert(
        resolveRemoteAbsolutePath(
            "/(Reinstall)/BACKUP",
            "/MusicFree/MusicFreeBackup.json",
        ) === "/(Reinstall)/BACKUP/MusicFree/MusicFreeBackup.json",
        "relative backup path resolves under cloud root",
    );
    assert(
        resolveRemoteAbsolutePath(
            "/(Reinstall)/BACKUP",
            "/(Reinstall)/BACKUP/MusicFree/Download/song.mp3",
        ) === "/(Reinstall)/BACKUP/MusicFree/Download/song.mp3",
        "absolute paths under root are unchanged",
    );

    const backupPaths = getRemoteBackupPaths("/(Reinstall)/BACKUP");
    assert(
        backupPaths.file
            === "/(Reinstall)/BACKUP/MusicFree/MusicFreeBackup.json",
        "playlist backup file is under cloud root",
    );
    assert(
        backupPaths.legacyFile === "/MusicFree/MusicFreeBackup.json",
        "legacy backup path is preserved for restore fallback",
    );
}

function runSplitTests(): void {
    const split = splitWebdavUrlIntoServerAndRoot(
        "https://webdav.pcloud.com/(Reinstall)/BACKUP/",
    );
    assert(
        split.serverUrl === "https://webdav.pcloud.com/",
        "split extracts pCloud server URL",
    );
    assert(
        split.rootPath === "/(Reinstall)/BACKUP",
        "split extracts cloud root from legacy combined URL",
    );
}

function runMigrationTests(): void {
    const result = buildLegacyRemoteConfigMigration(
        {
            "backup.webdav.url":
                "https://webdav.pcloud.com/(Reinstall)/BACKUP/",
            "backup.webdav.username": "user",
            "backup.webdav.password": "pass",
        },
        { rawKeys: new Set(["backup.webdav.url"]) },
    );
    assert(result.migrated, "combined URL migration runs");
    assert(
        result.patch["backup.webdav.url"] === "https://webdav.pcloud.com/",
        "migration rewrites server URL",
    );
    assert(
        result.patch["backup.webdav.rootPath"] === "/(Reinstall)/BACKUP",
        "migration sets cloud root path",
    );
}

function runTests(): void {
    runPathTests();
    runSplitTests();
    runMigrationTests();
}

runTests();
