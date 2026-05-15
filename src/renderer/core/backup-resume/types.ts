export interface IBackupPluginEntry {
    srcUrl: string;
    version: string;
}

export interface IBackupSyncMeta {
    updatedAt: number;
    sourceDeviceId?: string;
}

export interface IBackupPayload {
    musicSheets: IMusic.IMusicSheetItem[];
    plugins: IBackupPluginEntry[];
    syncMeta?: IBackupSyncMeta;
}

export function parseBackupPayload(
    data: string | Record<string, unknown>,
): IBackupPayload {
    const dataObj = typeof data === "string" ? JSON.parse(data) : data;
    const musicSheets = Array.isArray(dataObj?.musicSheets)
        ? (dataObj.musicSheets as IMusic.IMusicSheetItem[])
        : [];
    const plugins = Array.isArray(dataObj?.plugins)
        ? (dataObj.plugins as IBackupPluginEntry[]).filter(
            (entry): entry is IBackupPluginEntry =>
                typeof entry?.srcUrl === "string" && entry.srcUrl.length > 0,
        )
        : [];
    const syncMeta =
        dataObj?.syncMeta &&
        typeof dataObj.syncMeta === "object" &&
        typeof (dataObj.syncMeta as IBackupSyncMeta).updatedAt === "number"
            ? (dataObj.syncMeta as IBackupSyncMeta)
            : undefined;

    return {
        musicSheets,
        plugins,
        ...(syncMeta ? { syncMeta } : {}),
    };
}
