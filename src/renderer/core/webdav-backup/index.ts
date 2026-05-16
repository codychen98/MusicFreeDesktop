import MusicSheet from "@/renderer/core/music-sheet";
import BackupResume from "@/renderer/core/backup-resume";
import AppConfig from "@shared/app-config/renderer";
import {
    clearWebdavPendingPushAfterManualRestore,
    recordWebdavUploadSuccess,
} from "@/renderer/core/webdav-sync/config";
import { cancelScheduledWebdavUpload } from "@/renderer/core/webdav-sync/upload";
import { AuthType, createClient } from "webdav";
import type { TFunction } from "i18next";
import { toast } from "react-toastify";

function getErrorReason(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

const WEBDAV_BACKUP_DIR = "/MusicFree";
const WEBDAV_BACKUP_FILE = "/MusicFree/MusicFreeBackup.json";

export class WebdavCredentialsIncompleteError extends Error {
    constructor() {
        super("WEBDAV_CREDENTIALS_INCOMPLETE");
        this.name = "WebdavCredentialsIncompleteError";
    }
}

function createWebdavClient() {
    const url = AppConfig.getConfig("backup.webdav.url");
    const username = AppConfig.getConfig("backup.webdav.username");
    const password = AppConfig.getConfig("backup.webdav.password");

    if (!url || !username || !password) {
        throw new WebdavCredentialsIncompleteError();
    }

    return createClient(url, {
        authType: AuthType.Password,
        username,
        password,
    });
}

export async function fetchRemoteBackupRaw(): Promise<string | null> {
    const client = createWebdavClient();

    if (!(await client.exists(WEBDAV_BACKUP_FILE))) {
        return null;
    }

    return (await client.getFileContents(WEBDAV_BACKUP_FILE, {
        format: "text",
    })) as string;
}

export async function uploadBackupToWebdav(): Promise<void> {
    const client = createWebdavClient();
    const basePayload = await BackupResume.exportBackupPayload();
    const payload = BackupResume.withWebdavUploadSyncMeta(basePayload);
    const backUp = BackupResume.serializeBackupPayload(payload);

    if (!(await client.exists(WEBDAV_BACKUP_DIR))) {
        await client.createDirectory(WEBDAV_BACKUP_DIR);
    }

    await client.putFileContents(WEBDAV_BACKUP_FILE, backUp, { overwrite: true });
}

export async function backupMusicSheetsToWebdav(t: TFunction) {
    await uploadBackupToWebdav();
    recordWebdavUploadSuccess();
}

/**
 * Manual restore from WebDAV (Settings or sidebar). Always runs regardless of
 * `pendingPush`; on success clears pending push so auto-sync does not overwrite
 * the server with a pre-restore local snapshot.
 */
export async function restoreMusicSheetsFromWebdav(t: TFunction) {
    cancelScheduledWebdavUpload();

    const resumeData = await fetchRemoteBackupRaw();

    if (resumeData === null) {
        throw new Error(t("settings.backup.webdav_backup_file_not_exist"));
    }

    await BackupResume.resume(
        resumeData,
        AppConfig.getConfig("backup.resumeBehavior") === "overwrite",
        { restorePlugins: false },
    );

    clearWebdavPendingPushAfterManualRestore();
    await MusicSheet.frontend.setupMusicSheets();
}

export async function backupMusicSheetsToWebdavWithToast(t: TFunction) {
    try {
        await backupMusicSheetsToWebdav(t);
        toast.success(t("settings.backup.backup_success"));
    } catch (error) {
        if (error instanceof WebdavCredentialsIncompleteError) {
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
        if (error instanceof WebdavCredentialsIncompleteError) {
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
