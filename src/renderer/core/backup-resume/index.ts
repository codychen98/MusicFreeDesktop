import MusicSheet from "../music-sheet";
import { runWithoutWebdavSyncNotify } from "@/renderer/core/webdav-sync/upload";
import { collectBackupPlugins, resumeBackupPlugins } from "./plugins";
import { withWebdavUploadSyncMeta } from "./sync-meta";
import {
    parseBackupPayload,
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
};

export async function exportBackupPayload(): Promise<IBackupPayload> {
    const musicSheets = await MusicSheet.frontend.exportAllSheetDetails();
    const plugins = collectBackupPlugins();
    return { musicSheets, plugins };
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
        const { musicSheets, plugins } = parseBackupPayload(data);

        if (restorePlugins) {
            await resumeBackupPlugins(plugins);
        }
        await resumeMusicSheets(musicSheets, overwrite);
    });
}

const BackupResume = {
    resume,
    exportBackupPayload,
    serializeBackupPayload,
    withWebdavUploadSyncMeta,
};

export default BackupResume;
