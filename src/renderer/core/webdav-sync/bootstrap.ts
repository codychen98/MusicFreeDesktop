import MusicSheet from "@/renderer/core/music-sheet";
import BackupResume from "@/renderer/core/backup-resume";
import {
    countTracksInBackupPayload,
    countTracksInMusicSheets,
} from "@/renderer/core/backup-resume/count";
import { parseBackupPayload } from "@/renderer/core/backup-resume/types";
import { fetchRemoteBackupRaw } from "@/renderer/core/webdav-backup";
import logger from "@shared/logger/renderer";
import {
    isWebdavAutoSyncEnabled,
    isWebdavCredentialsComplete,
    isWebdavPendingPush,
} from "./config";
import { confirmEmptyRemoteOverwrite } from "./empty-remote-dialog";
import { flushWebdavUpload, runWithoutWebdavSyncNotify } from "./upload";

const WEBDAV_SYNC_DEBUG_KEY = "webdavSyncDebug";

function webdavSyncLog(message: string, detail?: unknown) {
    if (localStorage.getItem(WEBDAV_SYNC_DEBUG_KEY) !== "1") {
        return;
    }
    if (detail !== undefined) {
        logger.logInfo(`[webdav-sync] ${message}`, detail);
        return;
    }
    logger.logInfo(`[webdav-sync] ${message}`);
}

async function autoPullFromRemote(raw: string): Promise<void> {
    await runWithoutWebdavSyncNotify(async (): Promise<void> => {
        await BackupResume.resume(raw, true, { restorePlugins: false });
    });
    MusicSheet.frontend.setupMusicSheets().catch((): undefined => undefined);
}

/**
 * Cold-start sync: push pending local changes before any auto-pull.
 */
export async function runWebdavBootstrapSync(): Promise<void> {
    if (!isWebdavAutoSyncEnabled() || !isWebdavCredentialsComplete()) {
        webdavSyncLog("bootstrap skipped (auto-sync off or credentials incomplete)");
        return;
    }

    if (isWebdavPendingPush()) {
        webdavSyncLog("bootstrap: pendingPush — flush push only, skip pull");
        const pushed = await flushWebdavUpload();
        webdavSyncLog(`bootstrap: push ${pushed ? "succeeded" : "failed"}`);
        return;
    }

    webdavSyncLog("bootstrap: no pendingPush — evaluate auto-pull");

    let raw: string | null;
    try {
        raw = await fetchRemoteBackupRaw();
    } catch (error) {
        webdavSyncLog("bootstrap: fetch remote failed", error);
        return;
    }

    if (raw === null) {
        webdavSyncLog("bootstrap: no remote backup file");
        return;
    }

    const payload = parseBackupPayload(raw);
    const remoteTrackCount = countTracksInBackupPayload(payload);
    const localTrackCount = countTracksInMusicSheets(MusicSheet.frontend.getAllSheets());

    if (remoteTrackCount === 0 && localTrackCount > 0) {
        webdavSyncLog("bootstrap: empty remote with local data — asking user");
        const confirmed = await confirmEmptyRemoteOverwrite();
        if (!confirmed) {
            webdavSyncLog("bootstrap: user cancelled empty remote overwrite");
            return;
        }
        webdavSyncLog("bootstrap: user confirmed empty remote overwrite");
        try {
            await autoPullFromRemote(raw);
            webdavSyncLog("bootstrap: empty remote pull finished");
        } catch (error) {
            webdavSyncLog("bootstrap: empty remote pull failed", error);
        }
        return;
    }

    if (remoteTrackCount === 0) {
        webdavSyncLog("bootstrap: remote and local empty — nothing to pull");
        return;
    }

    webdavSyncLog(`bootstrap: auto-pull ${remoteTrackCount} remote track(s) (overwrite)`);
    try {
        await autoPullFromRemote(raw);
        webdavSyncLog("bootstrap: auto-pull finished");
    } catch (error) {
        webdavSyncLog("bootstrap: auto-pull failed", error);
    }
}
