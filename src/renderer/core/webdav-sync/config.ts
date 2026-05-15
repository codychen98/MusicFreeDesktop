import AppConfig from "@shared/app-config/renderer";

export function isWebdavCredentialsComplete(): boolean {
    const url = AppConfig.getConfig("backup.webdav.url");
    const username = AppConfig.getConfig("backup.webdav.username");
    const password = AppConfig.getConfig("backup.webdav.password");
    return Boolean(url && username && password);
}

export function isWebdavAutoSyncEnabled(): boolean {
    return AppConfig.getConfig("backup.webdav.autoSync") === true;
}

export function isWebdavPendingPush(): boolean {
    return AppConfig.getConfig("backup.webdav.pendingPush") === true;
}

export function setWebdavPendingPush(value: boolean): void {
    AppConfig.setConfig({ "backup.webdav.pendingPush": value });
}

export function setWebdavLastSuccessfulPushAt(timestampMs: number): void {
    AppConfig.setConfig({ "backup.webdav.lastSuccessfulPushAt": timestampMs });
}

export function getWebdavLastSuccessfulPushAt(): number | null | undefined {
    return AppConfig.getConfig("backup.webdav.lastSuccessfulPushAt");
}

export function recordWebdavUploadSuccess(): void {
    setWebdavPendingPush(false);
    setWebdavLastSuccessfulPushAt(Date.now());
}

/** After explicit Restore from WebDAV — local now matches remote; do not auto-push stale state. */
export function clearWebdavPendingPushAfterManualRestore(): void {
    setWebdavPendingPush(false);
}
