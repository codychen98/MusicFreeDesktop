export interface IBackupPluginEntry {
    srcUrl: string;
    version: string;
}

export interface IBackupSyncMeta {
    updatedAt: number;
    sourceDeviceId?: string;
}

/** Plugin tab order: platform/name → sort index. Optional on old backups. */
export type IBackupPluginOrder = Record<string, number>;

export interface IBackupPayload {
    musicSheets: IMusic.IMusicSheetItem[];
    plugins: IBackupPluginEntry[];
    pluginOrder?: IBackupPluginOrder;
    syncMeta?: IBackupSyncMeta;
}

/**
 * Tolerant parse of optional `pluginOrder`.
 * Missing / non-object / empty-after-filter → undefined (no-op for consumers).
 * Keeps only non-empty string keys with finite number values.
 */
export function parsePluginOrder(raw: unknown): IBackupPluginOrder | undefined {
    if (raw === null || raw === undefined || typeof raw !== "object") {
        return undefined;
    }
    if (Array.isArray(raw)) {
        return undefined;
    }

    const result: IBackupPluginOrder = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof key !== "string" || key.length === 0) {
            continue;
        }
        if (typeof value !== "number" || !Number.isFinite(value)) {
            continue;
        }
        result[key] = value;
    }

    return Object.keys(result).length > 0 ? result : undefined;
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
    const pluginOrder = parsePluginOrder(dataObj?.pluginOrder);

    return {
        musicSheets,
        plugins,
        ...(pluginOrder ? { pluginOrder } : {}),
        ...(syncMeta ? { syncMeta } : {}),
    };
}

/**
 * Map `private.pluginMeta` orders into backup `pluginOrder`.
 * Keeps only non-empty platform keys with finite numeric `order`.
 * Empty / missing → undefined (omit from payload).
 */
export function pluginMetaToBackupOrder(
    meta: Record<string, IPlugin.IPluginMeta> | null | undefined,
): IBackupPluginOrder | undefined {
    if (!meta || typeof meta !== "object") {
        return undefined;
    }

    const result: IBackupPluginOrder = {};
    for (const [platform, entry] of Object.entries(meta)) {
        if (typeof platform !== "string" || platform.length === 0) {
            continue;
        }
        const order = entry?.order;
        if (typeof order !== "number" || !Number.isFinite(order)) {
            continue;
        }
        result[platform] = order;
    }

    return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Remote-wins merge of backup `pluginOrder` into `private.pluginMeta`.
 * - Missing / undefined `pluginOrder` → undefined (caller no-ops; keep local).
 * - Preserves `userVariables` (and other non-order fields) on existing platforms.
 * - Sets `order` for every remote key (including not-yet-installed platforms).
 * - Drops local `order` for platforms absent from remote (remote-wins replace).
 */
export function applyBackupOrderToPluginMeta(
    meta: Record<string, IPlugin.IPluginMeta> | null | undefined,
    pluginOrder: IBackupPluginOrder | undefined,
): Record<string, IPlugin.IPluginMeta> | undefined {
    if (!pluginOrder) {
        return undefined;
    }

    const local = meta ?? {};
    const next: Record<string, IPlugin.IPluginMeta> = {};

    for (const [platform, entry] of Object.entries(local)) {
        if (platform in pluginOrder) {
            next[platform] = {
                ...entry,
                order: pluginOrder[platform],
            };
            continue;
        }

        const { order: _removed, ...rest } = entry;
        if (Object.keys(rest).length > 0) {
            next[platform] = { ...rest };
        }
    }

    for (const [platform, order] of Object.entries(pluginOrder)) {
        if (!(platform in next)) {
            next[platform] = { order };
        }
    }

    return next;
}
