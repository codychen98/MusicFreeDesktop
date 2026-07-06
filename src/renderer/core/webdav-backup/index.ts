import BackupResume from "@/renderer/core/backup-resume";
import AppConfig from "@shared/app-config/renderer";
import {
    clearWebdavPendingPushAfterManualRestore,
    recordWebdavUploadSuccess,
} from "@/renderer/core/webdav-sync/config";
import { cancelScheduledWebdavUpload } from "@/renderer/core/webdav-sync/upload";
import {
    getRemoteStorageCredentialsFromConfig,
    getWebdavRootPath,
    isRemoteCredentialsCompleteInConfig,
} from "@shared/remote-storage/remote-config";
import {
    createRemoteStorageClientWithTransport,
} from "@shared/remote-storage/resolve";
import { getRemoteBackupPaths } from "@shared/remote-storage/remote-paths";
import {
    RemoteCredentialsIncompleteError,
    RemoteTransportOfflineError,
} from "@shared/remote-storage/types";
import { awaitVerifiedRemoteTransport } from "@shared/remote-storage/verified-remote-transport-store";
import type { TFunction } from "i18next";
import { toast } from "react-toastify";

function getErrorReason(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}


function getBackupPathsFromConfig() {
    return getRemoteBackupPaths(
        getWebdavRootPath(AppConfig.getAllConfig()),
    );
}

/** @deprecated Use `RemoteCredentialsIncompleteError` */
export class WebdavCredentialsIncompleteError extends RemoteCredentialsIncompleteError {
    constructor() {
        super();
        this.name = "WebdavCredentialsIncompleteError";
    }
}

async function createRemoteBackupClient() {
    const config = AppConfig.getAllConfig();
    const credentials = getRemoteStorageCredentialsFromConfig(config);
    if (!isRemoteCredentialsCompleteInConfig(config)) {
        throw new RemoteCredentialsIncompleteError();
    }
    const transport = await awaitVerifiedRemoteTransport(credentials);
    if (!transport) {
        throw new RemoteTransportOfflineError();
    }
    return createRemoteStorageClientWithTransport(credentials, transport);
}

export async function fetchRemoteBackupRaw(): Promise<string | null> {
    const client = await createRemoteBackupClient();
    const paths = getBackupPathsFromConfig();

    if (await client.exists(paths.file)) {
        return client.getText(paths.file);
    }

    if (
        paths.legacyFile !== paths.file
        && (await client.exists(paths.legacyFile))
    ) {
        return client.getText(paths.legacyFile);
    }

    return null;
}

export async function uploadBackupToWebdav(): Promise<void> {
    const client = await createRemoteBackupClient();
    const paths = getBackupPathsFromConfig();
    const basePayload = await BackupResume.exportBackupPayload();
    const payload = BackupResume.withWebdavUploadSyncMeta(basePayload);
    const backUp = BackupResume.serializeBackupPayload(payload);

    await client.ensureDir(paths.dir);
    await client.putText(paths.file, backUp);
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
        if (error instanceof RemoteTransportOfflineError) {
            toast.error(t("settings.backup.remote_transport_offline"));
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
        if (error instanceof RemoteTransportOfflineError) {
            toast.error(t("settings.backup.remote_transport_offline"));
            return;
        }
        toast.error(
            t("settings.backup.resume_fail", {
                reason: getErrorReason(error),
            }),
        );
    }
}
