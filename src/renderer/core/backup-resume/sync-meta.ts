import { nanoid } from "nanoid";
import AppConfig from "@shared/app-config/renderer";
import type { IBackupPayload } from "./types";

export function getOrEnsureBackupSourceDeviceId(): string {
    const existing = AppConfig.getConfig("private.backupSourceDeviceId");
    if (typeof existing === "string" && existing.length > 0) {
        return existing;
    }
    const id = nanoid();
    AppConfig.setConfig({ "private.backupSourceDeviceId": id });
    return id;
}

/**
 * Snapshot fields for WebDAV upload: `updatedAt` at serialize time (just before PUT).
 */
export function withWebdavUploadSyncMeta(payload: IBackupPayload): IBackupPayload {
    return {
        ...payload,
        syncMeta: {
            updatedAt: Date.now(),
            sourceDeviceId: getOrEnsureBackupSourceDeviceId(),
        },
    };
}
