import {
    buildRenamedAudioFilename,
    buildNewLocalAudioPath,
    getAudioBasename,
    localSidecarPathsForAudio,
} from "@/common/rename-download-path";
import { remotePathFor } from "@/common/webdav-download-path";
import musicSheetDB from "@/renderer/core/db/music-sheet-db";
import { isDownloaded, updateDownloadedMusicInList } from "@/renderer/core/downloader/downloaded-sheet";
import { migrateTrackToWebdavSource } from "@/renderer/core/migrate-track-to-webdav-source";
import {
    getAllSheets,
    queryAllSheets,
} from "@/renderer/core/music-sheet/backend";
import { notifySheetsChanged } from "@/renderer/core/music-sheet/frontend";
import trackPlayer from "@/renderer/core/track-player";
import { WEBDAV_MUSIC_PLUGIN_PLATFORM } from "@/renderer/core/webdav-download/config";
import { renameWebdavRemoteTrack } from "@/renderer/core/webdav-download/rename";
import { markWebdavLocalMutation } from "@/renderer/core/webdav-sync/upload";
import { fsUtil } from "@shared/utils/renderer";

export class RenameTrackError extends Error {
    constructor(public readonly code: string) {
        super(code);
        this.name = "RenameTrackError";
    }
}

export interface RenameMusicTrackInput {
    title: string;
    artist: string;
}

function computeNewRemoteAudioPath(
    oldRemoteAudioPath: string,
    title: string,
    artist: string,
): string {
    const normalized = oldRemoteAudioPath.replace(/\\/g, "/");
    const lastSlash = normalized.lastIndexOf("/");
    const remoteDir =
        lastSlash === -1 ? "" : normalized.slice(0, lastSlash);
    const currentFilename =
        lastSlash === -1 ? normalized : normalized.slice(lastSlash + 1);
    const newFilename = buildRenamedAudioFilename(
        currentFilename,
        title,
        artist,
    );
    return remotePathFor(remoteDir, newFilename);
}

async function findSheetIdsContainingTrack(
    musicItem: IMusic.IMusicItem,
): Promise<string[]> {
    if (!getAllSheets().length) {
        await queryAllSheets();
    }
    return getAllSheets()
        .filter((sheet) =>
            (sheet.musicList ?? []).some((ref) => isSameMedia(ref, musicItem)),
        )
        .map((sheet) => sheet.id);
}

async function updateDownloadedListItem(
    updatedItem: IMusic.IMusicItem,
): Promise<void> {
    if (!isDownloaded(updatedItem)) {
        return;
    }
    updateDownloadedMusicInList(updatedItem);
}

async function updateMusicMetadataInStore(
    musicItem: IMusic.IMusicItem,
    updates: {
        title: string;
        artist: string;
        downloadPath?: string;
    },
): Promise<IMusic.IMusicItem> {
    let newItem!: IMusic.IMusicItem;

    await musicSheetDB.transaction("rw", musicSheetDB.musicStore, async () => {
        const row = await musicSheetDB.musicStore.get([
            musicItem.platform,
            musicItem.id,
        ]);
        if (!row) {
            throw new RenameTrackError("RENAME_STORE_ROW_MISSING");
        }

        const updated = {
            ...row,
            title: updates.title,
            artist: updates.artist,
        };

        if (updates.downloadPath !== undefined) {
            const existingDownload =
                getInternalData<IMusic.IMusicItemInternalData>(
                    row,
                    "downloadData",
                );
            if (!existingDownload?.path) {
                throw new RenameTrackError("RENAME_DOWNLOAD_PATH_MISSING");
            }
            setInternalData(updated, "downloadData", {
                ...existingDownload,
                path: updates.downloadPath,
            });
        }

        await musicSheetDB.musicStore.put(updated);
        newItem = updated;
    });

    const sheetIds = await findSheetIdsContainingTrack(musicItem);
    await notifySheetsChanged(sheetIds);
    trackPlayer.replaceMatchingMusic(musicItem, newItem);
    await updateDownloadedListItem(newItem);
    markWebdavLocalMutation();
    return newItem;
}

async function assertLocalRenameTargetsFree(
    oldAudioPath: string,
    newAudioPath: string,
): Promise<void> {
    if (await fsUtil.isFile(newAudioPath)) {
        throw new RenameTrackError("RENAME_TARGET_EXISTS");
    }

    const oldSidecars = localSidecarPathsForAudio(oldAudioPath);
    const newSidecars = localSidecarPathsForAudio(newAudioPath);

    if (await fsUtil.isFile(oldSidecars.lrcPath)) {
        if (await fsUtil.isFile(newSidecars.lrcPath)) {
            throw new RenameTrackError("RENAME_TARGET_EXISTS");
        }
    }

    if (await fsUtil.isFile(oldSidecars.tranLrcPath)) {
        if (await fsUtil.isFile(newSidecars.tranLrcPath)) {
            throw new RenameTrackError("RENAME_TARGET_EXISTS");
        }
    }
}

async function renameLocalFileIfExists(
    oldPath: string,
    newPath: string,
): Promise<void> {
    if (await fsUtil.isFile(oldPath)) {
        await fsUtil.rename(oldPath, newPath);
    }
}

async function renameLocalDownloadedTrack(
    musicItem: IMusic.IMusicItem,
    title: string,
    artist: string,
): Promise<IMusic.IMusicItem> {
    const currentPath = getInternalData<IMusic.IMusicItemInternalData>(
        musicItem,
        "downloadData",
    )?.path?.trim();
    if (!currentPath) {
        throw new RenameTrackError("RENAME_DOWNLOAD_PATH_MISSING");
    }

    const currentFilename = getAudioBasename(currentPath);
    const newFilename = buildRenamedAudioFilename(
        currentFilename,
        title,
        artist,
    );

    if (newFilename === currentFilename) {
        return updateMusicMetadataInStore(musicItem, { title, artist });
    }

    const newPath = buildNewLocalAudioPath(currentPath, title, artist);
    await assertLocalRenameTargetsFree(currentPath, newPath);

    const sidecars = localSidecarPathsForAudio(currentPath);
    const newSidecars = localSidecarPathsForAudio(newPath);

    try {
        await renameLocalFileIfExists(currentPath, newPath);
        await renameLocalFileIfExists(sidecars.lrcPath, newSidecars.lrcPath);
        await renameLocalFileIfExists(
            sidecars.tranLrcPath,
            newSidecars.tranLrcPath,
        );
    } catch {
        throw new RenameTrackError("RENAME_FILESYSTEM_FAILED");
    }

    return updateMusicMetadataInStore(musicItem, {
        title,
        artist,
        downloadPath: newPath,
    });
}

async function renameWebdavTrack(
    musicItem: IMusic.IMusicItem,
    title: string,
    artist: string,
): Promise<IMusic.IMusicItem> {
    const oldRemoteAudioPath = musicItem.id?.trim();
    if (!oldRemoteAudioPath) {
        throw new RenameTrackError("WEBDAV_REMOTE_PATH_MISSING");
    }

    const currentFilename = getAudioBasename(oldRemoteAudioPath);
    const newFilename = buildRenamedAudioFilename(
        currentFilename,
        title,
        artist,
    );

    if (newFilename === currentFilename) {
        return updateMusicMetadataInStore(musicItem, { title, artist });
    }

    const newRemoteAudioPath = computeNewRemoteAudioPath(
        oldRemoteAudioPath,
        title,
        artist,
    );

    try {
        await renameWebdavRemoteTrack({
            oldRemoteAudioPath,
            newRemoteAudioPath,
        });
    } catch (e: unknown) {
        if (e instanceof Error) {
            if (e.message === "WEBDAV_RENAME_TARGET_EXISTS") {
                throw new RenameTrackError("RENAME_TARGET_EXISTS");
            }
            throw e;
        }
        throw new RenameTrackError("RENAME_WEBDAV_FAILED");
    }

    const result = await migrateTrackToWebdavSource(musicItem, {
        remotePath: newRemoteAudioPath,
        title,
        artist,
        album: musicItem.album,
        duration: musicItem.duration,
    });
    markWebdavLocalMutation();
    return result.newItem;
}

export async function renameMusicTrack(
    musicItem: IMusic.IMusicItem,
    input: RenameMusicTrackInput,
): Promise<IMusic.IMusicItem> {
    const title = input.title.trim();
    const artist = input.artist.trim();
    if (!title || !artist) {
        throw new RenameTrackError("RENAME_INVALID_INPUT");
    }

    const isWebdav = musicItem.platform === WEBDAV_MUSIC_PLUGIN_PLATFORM;
    const isLocalDownload = isDownloaded(musicItem);
    if (!isWebdav && !isLocalDownload) {
        throw new RenameTrackError("RENAME_NOT_SUPPORTED");
    }

    if (isWebdav) {
        return renameWebdavTrack(musicItem, title, artist);
    }

    return renameLocalDownloadedTrack(musicItem, title, artist);
}
