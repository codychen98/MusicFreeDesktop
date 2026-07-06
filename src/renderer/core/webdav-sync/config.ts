import AppConfig from "@shared/app-config/renderer";
import {
    getRemoteAutoSync,
    getRemoteLastSuccessfulPushAt as readRemoteLastSuccessfulPushAt,
    getRemotePendingPush,
    isRemoteCredentialsCompleteInConfig,
} from "@shared/remote-storage/remote-config";
import {
    getVerifiedRemoteTransportStatus,
    isVerifiedRemoteTransportOnline,
} from "@shared/remote-storage/verified-remote-transport-store";

export function isRemoteCredentialsComplete(): boolean {
    const verifiedStatus = getVerifiedRemoteTransportStatus();
    if (verifiedStatus === "checking") {
        return isRemoteCredentialsCompleteInConfig(AppConfig.getAllConfig());
    }
    return isVerifiedRemoteTransportOnline(verifiedStatus);
}

export function isRemoteAutoSyncEnabled(): boolean {
    return getRemoteAutoSync(AppConfig.getAllConfig());
}

export function isRemotePendingPush(): boolean {
    return getRemotePendingPush(AppConfig.getAllConfig());
}

export function setRemotePendingPush(value: boolean): void {
    AppConfig.setConfig({ "backup.remote.pendingPush": value });
}

export function setRemoteLastSuccessfulPushAt(timestampMs: number): void {
    AppConfig.setConfig({
        "backup.remote.lastSuccessfulPushAt": timestampMs,
    });
}

export function getRemoteLastSuccessfulPushAt(): number | null | undefined {
    return readRemoteLastSuccessfulPushAt(AppConfig.getAllConfig());
}

export function recordRemoteUploadSuccess(): void {
    setRemotePendingPush(false);
    setRemoteLastSuccessfulPushAt(Date.now());
}

/** After explicit Restore from remote — local now matches remote; do not auto-push stale state. */
export function clearRemotePendingPushAfterManualRestore(): void {
    setRemotePendingPush(false);
}

/** @deprecated Use `isRemoteCredentialsComplete` */
export const isWebdavCredentialsComplete = isRemoteCredentialsComplete;

/** @deprecated Use `isRemoteAutoSyncEnabled` */
export const isWebdavAutoSyncEnabled = isRemoteAutoSyncEnabled;

/** @deprecated Use `isRemotePendingPush` */
export const isWebdavPendingPush = isRemotePendingPush;

/** @deprecated Use `setRemotePendingPush` */
export const setWebdavPendingPush = setRemotePendingPush;

/** @deprecated Use `setRemoteLastSuccessfulPushAt` */
export const setWebdavLastSuccessfulPushAt = setRemoteLastSuccessfulPushAt;

/** @deprecated Use `getRemoteLastSuccessfulPushAt` */
export const getWebdavLastSuccessfulPushAt = getRemoteLastSuccessfulPushAt;

/** @deprecated Use `recordRemoteUploadSuccess` */
export const recordWebdavUploadSuccess = recordRemoteUploadSuccess;

/** @deprecated Use `clearRemotePendingPushAfterManualRestore` */
export const clearWebdavPendingPushAfterManualRestore =
    clearRemotePendingPushAfterManualRestore;
