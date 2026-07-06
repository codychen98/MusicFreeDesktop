import debounce from "lodash.debounce";
import AppConfig from "@shared/app-config/renderer";
import { uploadBackupToWebdav } from "@/renderer/core/webdav-backup";
import {
    isRemoteAutoSyncEnabled,
    isRemoteCredentialsComplete,
    isRemotePendingPush,
    recordRemoteUploadSuccess,
    setRemotePendingPush,
} from "./config";

const UPLOAD_DEBOUNCE_MS = 3000;

let suppressNotifyDepth = 0;

export function runWithoutWebdavSyncNotify<T>(fn: () => T | Promise<T>): Promise<T> {
    suppressNotifyDepth += 1;
    return Promise.resolve(fn()).finally(() => {
        suppressNotifyDepth -= 1;
    });
}

/** @deprecated Use `runWithoutWebdavSyncNotify` (name kept for compat) */
export const runWithoutRemoteSyncNotify = runWithoutWebdavSyncNotify;

function isNotifySuppressed(): boolean {
    return suppressNotifyDepth > 0;
}

export function markRemoteBackupMutation(): void {
    if (isNotifySuppressed() || !isRemoteAutoSyncEnabled()) {
        return;
    }
    setRemotePendingPush(true);
    scheduleDebouncedRemoteUpload();
}

/** @deprecated Use `markRemoteBackupMutation` */
export const markWebdavLocalMutation = markRemoteBackupMutation;

export async function flushRemoteUpload(): Promise<boolean> {
    if (!isRemoteAutoSyncEnabled() || !isRemoteCredentialsComplete()) {
        return false;
    }
    try {
        await uploadBackupToWebdav();
        recordRemoteUploadSuccess();
        return true;
    } catch {
        setRemotePendingPush(true);
        return false;
    }
}

/** @deprecated Use `flushRemoteUpload` */
export const flushWebdavUpload = flushRemoteUpload;

const debouncedFlushRemoteUpload = debounce(
    () => {
        void flushRemoteUpload();
    },
    UPLOAD_DEBOUNCE_MS,
    { leading: false, trailing: true },
);

export function scheduleDebouncedRemoteUpload(): void {
    if (!isRemoteAutoSyncEnabled() || !isRemoteCredentialsComplete()) {
        return;
    }
    debouncedFlushRemoteUpload();
}

/** @deprecated Use `scheduleDebouncedRemoteUpload` */
export const scheduleDebouncedWebdavUpload = scheduleDebouncedRemoteUpload;

export function cancelScheduledRemoteUpload(): void {
    debouncedFlushRemoteUpload.cancel();
}

/** @deprecated Use `cancelScheduledRemoteUpload` */
export const cancelScheduledWebdavUpload = cancelScheduledRemoteUpload;

export function setupWebdavAutoSync(): void {
    AppConfig.onConfigUpdate((patch) => {
        if (!isRemoteAutoSyncEnabled()) {
            return;
        }
        const credentialsTouched =
            "backup.webdav.url" in patch
            || "backup.webdav.rootPath" in patch
            || "backup.webdav.username" in patch
            || "backup.webdav.password" in patch
            || "backup.remote.pcloud.hostname" in patch
            || "backup.remote.pcloud.tokenJson" in patch;
        const autoSyncEnabled =
            patch["backup.remote.autoSync"] === true
            || patch["backup.webdav.autoSync"] === true;
        if (
            (credentialsTouched || autoSyncEnabled)
            && isRemotePendingPush()
        ) {
            scheduleDebouncedRemoteUpload();
        }
    });
}
