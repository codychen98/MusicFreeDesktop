import BackupResume from "@/renderer/core/backup-resume";
import AppConfig from "@shared/app-config/renderer";
import {
    clearWebdavPendingPushAfterManualRestore,
    recordWebdavUploadSuccess,
} from "@/renderer/core/webdav-sync/config";
import { cancelScheduledWebdavUpload } from "@/renderer/core/webdav-sync/upload";
import {
    getRemoteStorageCredentialsFromConfig,
    isRemoteCredentialsCompleteInConfig,
} from "@shared/remote-storage/remote-config";
import { createRemoteStorageClient } from "@shared/remote-storage/resolve";
import { RemoteCredentialsIncompleteError } from "@shared/remote-storage/types";
import type { TFunction } from "i18next";
import { toast } from "react-toastify";

function getErrorReason(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

const REMOTE_BACKUP_DIR = "/MusicFree";
const REMOTE_BACKUP_FILE = "/MusicFree/MusicFreeBackup.json";

/** @deprecated Use `RemoteCredentialsIncompleteError` */
export class WebdavCredentialsIncompleteError extends RemoteCredentialsIncompleteError {
    constructor() {
        super();
        this.name = "WebdavCredentialsIncompleteError";
    }
}

function createRemoteBackupClient() {
    const config = AppConfig.getAllConfig();
    if (!isRemoteCredentialsCompleteInConfig(config)) {
        throw new RemoteCredentialsIncompleteError();
    }
    return createRemoteStorageClient(
        getRemoteStorageCredentialsFromConfig(config),
    );
}

export async function fetchRemoteBackupRaw(): Promise<string | null> {
    const client = createRemoteBackupClient();

    if (!(await client.exists(REMOTE_BACKUP_FILE))) {
        return null;
    }

    return client.getText(REMOTE_BACKUP_FILE);
}

export async function uploadBackupToWebdav(): Promise<void> {
    const client = createRemoteBackupClient();
    const basePayload = await BackupResume.exportBackupPayload();
    const payload = BackupResume.withWebdavUploadSyncMeta(basePayload);
    const backUp = BackupResume.serializeBackupPayload(payload);

    await client.ensureDir(REMOTE_BACKUP_DIR);
    await client.putText(REMOTE_BACKUP_FILE, backUp);
}

export async function backupMusicSheetsToWebdav(t: TFunction) {
    await uploadBackupToWebdav();
    recordWebdavUploadSuccess();
}

/**
 * Manual restore from remote storage (Settings or sidebar). Always runs regardless of
 * `pendingPush`; on success clears pending push so auto-sync does not overwrite
 * the server with a pre-restore local snapshot.
 *
 * Remote restore always full-overwrites local playlists (remote is source of
 * truth). `backup.resumeBehavior` applies to local file restore only.
 */
export async function restoreMusicSheetsFromWebdav(t: TFunction) {
    cancelScheduledWebdavUpload();

    const resumeData = await fetchRemoteBackupRaw();

    if (resumeData === null) {
        throw new Error(t("settings.backup.webdav_backup_file_not_exist"));
    }

    await BackupResume.resume(resumeData, true, {
        restorePlugins: false,
        fullSheetOverwrite: true,
    });

    clearWebdavPendingPushAfterManualRestore();
}

export async function backupMusicSheetsToWebdavWithToast(t: TFunction) {
    try {
        await backupMusicSheetsToWebdav(t);
        toast.success(t("settings.backup.backup_success"));
    } catch (error) {
        if (
            error instanceof RemoteCredentialsIncompleteError
            || error instanceof WebdavCredentialsIncompleteError
        ) {
            toast.error(t("settings.backup.webdav_data_not_complete"));
            return;
        }
        toast.error(
            t("settings.backup.backup_fail", {
                reason: getErrorReason(error),
            }),
        );
    }
}

export async function restoreMusicSheetsFromWebdavWithToast(t: TFunction) {
    try {
        await restoreMusicSheetsFromWebdav(t);
        toast.success(t("settings.backup.resume_success"));
    } catch (error) {
        if (
            error instanceof RemoteCredentialsIncompleteError
            || error instanceof WebdavCredentialsIncompleteError
        ) {
            toast.error(t("settings.backup.webdav_data_not_complete"));
            return;
        }
        toast.error(
            t("settings.backup.resume_fail", {
                reason: getErrorReason(error),
            }),
        );
    }
}
