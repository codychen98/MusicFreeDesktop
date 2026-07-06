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
    clearRemotePendingPushAfterManualRestore,
    isRemoteAutoSyncEnabled,
    isRemoteCredentialsComplete,
    isRemotePendingPush,
} from "./config";
import { confirmEmptyRemoteOverwrite } from "./empty-remote-dialog";
import { flushRemoteUpload, runWithoutWebdavSyncNotify } from "./upload";

const REMOTE_SYNC_DEBUG_KEY = "webdavSyncDebug";

function remoteSyncLog(message: string, detail?: unknown) {
    if (localStorage.getItem(REMOTE_SYNC_DEBUG_KEY) !== "1") {
        return;
    }
    if (detail !== undefined) {
        logger.logInfo(`[remote-sync] ${message}`, detail);
        return;
    }
    logger.logInfo(`[remote-sync] ${message}`);
}

async function autoPullFromRemote(raw: string): Promise<void> {
    await runWithoutWebdavSyncNotify(async (): Promise<void> => {
        await BackupResume.resume(raw, true, {
            restorePlugins: false,
            fullSheetOverwrite: true,
        });
    });
    clearRemotePendingPushAfterManualRestore();
}

/**
 * Cold-start sync: when `MusicFreeBackup.json` exists on remote storage, always pull with full
 * sheet overwrite (remote is source of truth). `pendingPush` does not skip pull.
 * Empty remote + non-empty local: blocking dialog before overwrite.
 * No remote file: push local snapshot if pending, so first backup can be created.
 */
export async function runWebdavBootstrapSync(): Promise<void> {
    if (!isRemoteAutoSyncEnabled() || !isRemoteCredentialsComplete()) {
        remoteSyncLog("bootstrap skipped (auto-sync off or credentials incomplete)");
        return;
    }

    remoteSyncLog("bootstrap: remote-wins — evaluate auto-pull");

    let raw: string | null;
    try {
        raw = await fetchRemoteBackupRaw();
    } catch (error) {
        remoteSyncLog("bootstrap: fetch remote failed", error);
        if (isRemotePendingPush()) {
            const pushed = await flushRemoteUpload();
            remoteSyncLog(
                `bootstrap: fetch failed — flush pending push ${pushed ? "succeeded" : "failed"}`,
            );
        }
        return;
    }

    if (raw === null) {
        remoteSyncLog("bootstrap: no remote backup file");
        if (isRemotePendingPush()) {
            const pushed = await flushRemoteUpload();
            remoteSyncLog(
                `bootstrap: no remote — flush pending push ${pushed ? "succeeded" : "failed"}`,
            );
        }
        return;
    }

    const payload = parseBackupPayload(raw);
    const remoteTrackCount = countTracksInBackupPayload(payload);
    const localTrackCount = countTracksInMusicSheets(MusicSheet.frontend.getAllSheets());

    if (remoteTrackCount === 0 && localTrackCount > 0) {
        remoteSyncLog("bootstrap: empty remote with local data — asking user");
        const confirmed = await confirmEmptyRemoteOverwrite();
        if (!confirmed) {
            remoteSyncLog("bootstrap: user cancelled empty remote overwrite");
            return;
        }
        remoteSyncLog("bootstrap: user confirmed empty remote overwrite");
        try {
            await autoPullFromRemote(raw);
            remoteSyncLog("bootstrap: empty remote pull finished");
        } catch (error) {
            remoteSyncLog("bootstrap: empty remote pull failed", error);
        }
        return;
    }

    if (remoteTrackCount === 0) {
        remoteSyncLog("bootstrap: remote and local empty — nothing to pull");
        return;
    }

    remoteSyncLog(`bootstrap: auto-pull ${remoteTrackCount} remote track(s) (overwrite)`);
    try {
        await autoPullFromRemote(raw);
        remoteSyncLog("bootstrap: auto-pull finished");
    } catch (error) {
        remoteSyncLog("bootstrap: auto-pull failed", error);
    }
}
