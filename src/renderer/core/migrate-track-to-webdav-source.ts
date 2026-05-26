import { isSameMedia } from "@/common/media-util";
import {
    internalDataKey,
    localPluginName,
    musicRefSymbol,
    sortIndexSymbol,
    timeStampSymbol,
} from "@/common/constant";
import musicSheetDB from "@/renderer/core/db/music-sheet-db";
import defaultSheet from "@/renderer/core/music-sheet/common/default-sheet";
import {
    getAllSheets,
    queryAllSheets,
    replaceFavoriteMusicId,
} from "@/renderer/core/music-sheet/backend";
import { notifySheetsChanged } from "@/renderer/core/music-sheet/frontend";
import { markWebdavLocalMutation } from "@/renderer/core/webdav-sync/upload";
import { replaceMatchingInRecentlyPlaylist } from "@/renderer/core/recently-playlist";
import trackPlayer from "@/renderer/core/track-player";
import localMusicListStore from "@/renderer/core/local-music/store";
import { WEBDAV_MUSIC_PLUGIN_PLATFORM } from "@/renderer/core/webdav-download/config";
import { removeDownloadedMusicIfPresent } from "@/renderer/core/downloader/downloaded-migration";

/** Row shape for `musicSheetDB.musicStore` (see `music-sheet-db.ts`). */
type MusicStoreRow = IMusic.IMusicItem & { $$ref: number };

export interface MigrateTrackToWebdavParams {
    remotePath: string;
    title: string;
    artist: string;
    album?: string;
    duration?: number;
}

export interface MigrateTrackToWebdavResult {
    newItem: IMusic.IMusicItem;
    sheetsReplaced: number;
    historyReplaced: number;
    playListReplaced: number;
    localRemoved: boolean;
}

function buildMigratedMusicItem(
    seed: IMusic.IMusicItem,
    params: MigrateTrackToWebdavParams,
): IMusic.IMusicItem {
    const next: IMusic.IMusicItem = {
        ...seed,
        platform: WEBDAV_MUSIC_PLUGIN_PLATFORM,
        id: params.remotePath,
        title: params.title,
        artist: params.artist,
        album: params.album ?? seed.album ?? "未知专辑",
        duration: params.duration ?? seed.duration ?? 0,
    };
    if (next[internalDataKey]) {
        const internal = { ...next[internalDataKey] };
        delete (internal as IMusic.IMusicItemInternalData).downloadData;
        if (Object.keys(internal).length) {
            next[internalDataKey] = internal;
        } else {
            next[internalDataKey] = undefined;
        }
    }
    return next;
}

interface ReplaceMatchingMusicEverywhereResult {
    sheetsReplaced: number;
    affectedSheetIds: string[];
}

async function replaceMatchingMusicEverywhere(
    oldItem: IMusic.IMusicItem,
    newItem: IMusic.IMusicItem,
): Promise<ReplaceMatchingMusicEverywhereResult> {
    if (!getAllSheets().length) {
        await queryAllSheets();
    }
    const sheets = getAllSheets();
    let total = 0;
    const affectedSheetIds: string[] = [];

    await musicSheetDB.transaction(
        "rw",
        musicSheetDB.sheets,
        musicSheetDB.musicStore,
        async () => {
            for (const sheet of sheets) {
                const list = sheet.musicList ?? [];
                let sheetChanged = false;
                const newList = list.map((ref) => {
                    if (!isSameMedia(ref, oldItem)) {
                        return ref;
                    }
                    sheetChanged = true;
                    total += 1;
                    return {
                        platform: newItem.platform,
                        id: newItem.id,
                        [sortIndexSymbol]: ref[sortIndexSymbol],
                        [timeStampSymbol]: ref[timeStampSymbol],
                    };
                });
                if (!sheetChanged) {
                    continue;
                }
                affectedSheetIds.push(sheet.id);
                await musicSheetDB.sheets.update(sheet.id, {
                    musicList: newList,
                });
                sheet.musicList = newList;
            }

            if (total === 0) {
                return;
            }

            const existingNew = await musicSheetDB.musicStore.get([
                newItem.platform,
                newItem.id,
            ]);
            const toPut: MusicStoreRow = existingNew
                ? {
                    ...existingNew,
                    ...newItem,
                    $$ref: existingNew[musicRefSymbol] + total,
                }
                : {
                    ...newItem,
                    $$ref: total,
                };
            await musicSheetDB.musicStore.put(toPut);

            const oldStored = await musicSheetDB.musicStore.get([
                oldItem.platform,
                oldItem.id,
            ]);
            if (oldStored) {
                oldStored[musicRefSymbol] -= total;
                if (oldStored[musicRefSymbol] <= 0) {
                    await musicSheetDB.musicStore.delete([
                        oldItem.platform,
                        oldItem.id,
                    ]);
                } else {
                    await musicSheetDB.musicStore.put(oldStored);
                }
            }
        },
    );

    if (total > 0) {
        markWebdavLocalMutation();
    }
    return { sheetsReplaced: total, affectedSheetIds };
}

async function removeLocalDuplicates(
    oldItem: IMusic.IMusicItem,
    newItem: IMusic.IMusicItem,
): Promise<boolean> {
    let removed = false;
    const locals = localMusicListStore.getValue();
    const toDelete: Array<[string, string]> = [];

    for (const row of locals) {
        if (row.platform !== localPluginName) {
            continue;
        }
        if (
            isSameMedia(oldItem, row) ||
            (row.title === newItem.title &&
                row.artist === newItem.artist &&
                !isSameMedia(oldItem, row))
        ) {
            toDelete.push([row.platform, row.id]);
            removed = true;
        }
    }

    if (toDelete.length) {
        await musicSheetDB.localMusicStore.bulkDelete(toDelete);
        localMusicListStore.setValue(
            locals.filter(
                (row) =>
                    !toDelete.some(
                        ([p, id]) => row.platform === p && row.id === id,
                    ),
            ),
        );
    }
    return removed;
}

export async function migrateTrackToWebdavSource(
    oldItem: IMusic.IMusicItem,
    params: MigrateTrackToWebdavParams,
): Promise<MigrateTrackToWebdavResult> {
    const newItem = buildMigratedMusicItem(oldItem, params);
    const { sheetsReplaced, affectedSheetIds } =
        await replaceMatchingMusicEverywhere(oldItem, newItem);
    if (affectedSheetIds.includes(defaultSheet.id)) {
        replaceFavoriteMusicId(oldItem, newItem);
    }
    await notifySheetsChanged(affectedSheetIds);
    const historyReplaced = await replaceMatchingInRecentlyPlaylist(
        oldItem,
        newItem,
    );
    const playListReplaced = trackPlayer.replaceMatchingMusic(
        oldItem,
        newItem,
    );
    const localRemoved = await removeLocalDuplicates(oldItem, newItem);
    await removeDownloadedMusicIfPresent(oldItem);

    return {
        newItem,
        sheetsReplaced,
        historyReplaced,
        playListReplaced,
        localRemoved,
    };
}
