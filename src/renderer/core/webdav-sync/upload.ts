import debounce from "lodash.debounce";
import AppConfig from "@shared/app-config/renderer";
import { uploadBackupToWebdav } from "@/renderer/core/webdav-backup";
import {
    isWebdavAutoSyncEnabled,
    isWebdavCredentialsComplete,
    recordWebdavUploadSuccess,
    setWebdavPendingPush,
} from "./config";

const UPLOAD_DEBOUNCE_MS = 3000;

let suppressNotifyDepth = 0;

export function runWithoutWebdavSyncNotify<T>(fn: () => T | Promise<T>): Promise<T> {
    suppressNotifyDepth += 1;
    return Promise.resolve(fn()).finally(() => {
        suppressNotifyDepth -= 1;
    });
}

function isNotifySuppressed(): boolean {
    return suppressNotifyDepth > 0;
}

export function markWebdavLocalMutation(): void {
    if (isNotifySuppressed() || !isWebdavAutoSyncEnabled()) {
        return;
    }
    setWebdavPendingPush(true);
    scheduleDebouncedWebdavUpload();
}

export async function flushWebdavUpload(): Promise<boolean> {
    if (!isWebdavAutoSyncEnabled() || !isWebdavCredentialsComplete()) {
        return false;
    }
    try {
        await uploadBackupToWebdav();
        recordWebdavUploadSuccess();
        return true;
    } catch {
        setWebdavPendingPush(true);
        return false;
    }
}

const debouncedFlushWebdavUpload = debounce(
    () => {
        void flushWebdavUpload();
    },
    UPLOAD_DEBOUNCE_MS,
    { leading: false, trailing: true },
);

export function scheduleDebouncedWebdavUpload(): void {
    if (!isWebdavAutoSyncEnabled() || !isWebdavCredentialsComplete()) {
        return;
    }
    debouncedFlushWebdavUpload();
}

export function cancelScheduledWebdavUpload(): void {
    debouncedFlushWebdavUpload.cancel();
}

export function setupWebdavAutoSync(): void {
    AppConfig.onConfigUpdate((patch) => {
        if (!isWebdavAutoSyncEnabled()) {
            return;
        }
        const credentialsTouched =
            "backup.webdav.url" in patch ||
            "backup.webdav.username" in patch ||
            "backup.webdav.password" in patch;
        const autoSyncEnabled = patch["backup.webdav.autoSync"] === true;
        if ((credentialsTouched || autoSyncEnabled) && AppConfig.getConfig("backup.webdav.pendingPush")) {
            scheduleDebouncedWebdavUpload();
        }
    });
}
