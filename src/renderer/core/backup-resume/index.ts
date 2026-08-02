import MusicSheet from "../music-sheet";
import AppConfig from "@shared/app-config/renderer";
import { runWithoutWebdavSyncNotify } from "@/renderer/core/webdav-sync/upload";
import { collectBackupPlugins, resumeBackupPlugins } from "./plugins";
import { withWebdavUploadSyncMeta } from "./sync-meta";
import {
    applyBackupOrderToPluginMeta,
    parseBackupPayload,
    pluginMetaToBackupOrder,
    type IBackupPayload,
} from "./types";

export type {
    IBackupPayload,
    IBackupPluginEntry,
    IBackupSyncMeta,
} from "./types";

export type BackupResumeOptions = {
    /** When false, skip reinstalling plugins from backup URLs (e.g. WebDAV restore). Default true. */
    restorePlugins?: boolean;
    /** Atomic replace local sheets/tracks with remote payload (WebDAV auto-pull / overwrite restore). */
    fullSheetOverwrite?: boolean;
};

export async function exportBackupPayload(): Promise<IBackupPayload> {
    const musicSheets = await MusicSheet.frontend.exportAllSheetDetails();
    const plugins = collectBackupPlugins();
    const pluginOrder = pluginMetaToBackupOrder(
        AppConfig.getConfig("private.pluginMeta"),
    );
    return {
        musicSheets,
        plugins,
        ...(pluginOrder ? { pluginOrder } : {}),
    };
}

export function serializeBackupPayload(payload: IBackupPayload) {
    return JSON.stringify(payload, undefined, 0);
}

async function resumeMusicSheets(
    allSheets: IMusic.IMusicSheetItem[],
    overwrite?: boolean,
) {
    const currentSheets = MusicSheet.frontend.getAllSheets();

    let importedDefaultSheet;
    for (const sheet of allSheets) {
        if (overwrite && sheet.id === MusicSheet.defaultSheet.id) {
            importedDefaultSheet = sheet;
            continue;
        }
        const newSheet = await MusicSheet.frontend.addSheet(sheet.title);
        await MusicSheet.frontend.addMusicToSheet(sheet.musicList, newSheet.id);
    }
    if (overwrite) {
        for (const sheet of currentSheets) {
            if (sheet.id === MusicSheet.defaultSheet.id) {
                if (importedDefaultSheet) {
                    await MusicSheet.frontend.clearSheet(MusicSheet.defaultSheet.id);
                    await MusicSheet.frontend.addMusicToFavorite(
                        importedDefaultSheet.musicList,
                    );
                }
            }
            await MusicSheet.frontend.removeSheet(sheet.id);
        }
    }
}

/**
 * Restore plugins first (unless disabled), then playlists (matches Android Backup.resume).
 */
async function resume(
    data: string | Record<string, unknown>,
    overwrite?: boolean,
    options?: BackupResumeOptions,
) {
    const restorePlugins = options?.restorePlugins !== false;
    return runWithoutWebdavSyncNotify(async () => {
        const { musicSheets, plugins, pluginOrder } = parseBackupPayload(data);

        // Apply even when restorePlugins is false (WebDAV pull); missing field = no-op.
        const nextPluginMeta = applyBackupOrderToPluginMeta(
            AppConfig.getConfig("private.pluginMeta"),
            pluginOrder,
        );
        if (nextPluginMeta) {
            AppConfig.setConfig({
                "private.pluginMeta": nextPluginMeta,
            });
        }

        if (restorePlugins) {
            await resumeBackupPlugins(plugins);
        }

        if (options?.fullSheetOverwrite) {
            await MusicSheet.frontend.resumeSheetsFullOverwrite(musicSheets);
        } else {
            await resumeMusicSheets(musicSheets, overwrite);
        }
    });
}

const BackupResume = {
    resume,
    exportBackupPayload,
    serializeBackupPayload,
    withWebdavUploadSyncMeta,
};

export default BackupResume;
