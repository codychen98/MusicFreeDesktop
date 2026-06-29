import { getInternalData } from "@/common/media-util";
import { localSidecarPathsForAudio } from "@/common/rename-download-path";
import { isDownloaded } from "@/renderer/core/downloader/downloaded-sheet";
import {
    getLinkedLyric,
    linkLyric,
    unlinkLyric,
} from "@/renderer/core/link-lyric";
import { WEBDAV_MUSIC_PLUGIN_PLATFORM } from "@/renderer/core/webdav-download/config";
import { uploadRemoteSidecarLyrics } from "@/renderer/core/webdav-download/sidecar";
import PluginManager from "@shared/plugin-manager/renderer";
import { WebdavMusicPluginConfigIncompleteError } from "@shared/webdav-music-upload/types";
import { fsUtil } from "@shared/utils/renderer";

export class SaveSearchedLyricError extends Error {
    constructor(public readonly code: string) {
        super(code);
        this.name = "SaveSearchedLyricError";
    }
}

export const SaveSearchedLyricErrorCode = {
    WEBDAV_CONFIG_INCOMPLETE: "WEBDAV_CONFIG_INCOMPLETE",
    LYRIC_EMPTY: "LYRIC_EMPTY",
    UPLOAD_FAILED: "UPLOAD_FAILED",
    DOWNLOAD_PATH_MISSING: "DOWNLOAD_PATH_MISSING",
    WEBDAV_REMOTE_PATH_MISSING: "WEBDAV_REMOTE_PATH_MISSING",
} as const;

async function fetchLyricFromSearchResult(
    lyricItem: IMusic.IMusicItem,
): Promise<{ rawLrc: string; translation?: string }> {
    const lrcSource = await PluginManager.callPluginDelegateMethod(
        lyricItem,
        "getLyric",
        lyricItem,
    );
    let rawLrc = lrcSource?.rawLrc?.trim();
    let translation = lrcSource?.translation?.trim();
    if (!rawLrc && !translation) {
        throw new SaveSearchedLyricError(SaveSearchedLyricErrorCode.LYRIC_EMPTY);
    }
    if (!rawLrc) {
        rawLrc = translation;
        translation = undefined;
    }
    return { rawLrc: rawLrc!, translation };
}

async function writeLocalSidecarLyrics(
    audioPath: string,
    rawLrc: string,
    translation?: string,
): Promise<void> {
    const paths = localSidecarPathsForAudio(audioPath);
    await fsUtil.writeFile(paths.lrcPath, rawLrc, "utf8");
    if (translation) {
        await fsUtil.writeFile(paths.tranLrcPath, translation, "utf8");
    }
}

async function saveToWebdavSidecar(
    musicItem: IMusic.IMusicItem,
    rawLrc: string,
    translation?: string,
): Promise<void> {
    const remoteAudioPath = musicItem.id?.trim();
    if (!remoteAudioPath) {
        throw new SaveSearchedLyricError(
            SaveSearchedLyricErrorCode.WEBDAV_REMOTE_PATH_MISSING,
        );
    }
    try {
        await uploadRemoteSidecarLyrics({
            remoteAudioPath,
            rawLrc,
            translation,
        });
    } catch (e: unknown) {
        if (e instanceof WebdavMusicPluginConfigIncompleteError) {
            throw new SaveSearchedLyricError(
                SaveSearchedLyricErrorCode.WEBDAV_CONFIG_INCOMPLETE,
            );
        }
        if (e instanceof Error && e.message === "LYRIC_EMPTY") {
            throw new SaveSearchedLyricError(SaveSearchedLyricErrorCode.LYRIC_EMPTY);
        }
        throw new SaveSearchedLyricError(SaveSearchedLyricErrorCode.UPLOAD_FAILED);
    }
}

async function saveToLocalDownloadSidecar(
    musicItem: IMusic.IMusicItem,
    rawLrc: string,
    translation?: string,
): Promise<void> {
    const audioPath = getInternalData<IMusic.IMusicItemInternalData>(
        musicItem,
        "downloadData",
    )?.path?.trim();
    if (!audioPath) {
        throw new SaveSearchedLyricError(
            SaveSearchedLyricErrorCode.DOWNLOAD_PATH_MISSING,
        );
    }
    try {
        await writeLocalSidecarLyrics(audioPath, rawLrc, translation);
    } catch {
        throw new SaveSearchedLyricError(SaveSearchedLyricErrorCode.UPLOAD_FAILED);
    }
}

async function clearStaleLinkedLyricIfNeeded(
    musicItem: IMusic.IMusicItem,
): Promise<void> {
    const linked = await getLinkedLyric(musicItem);
    if (linked) {
        await unlinkLyric(musicItem);
    }
}

export async function saveSearchedLyric(
    musicItem: IMusic.IMusicItem,
    lyricItem: IMusic.IMusicItem,
): Promise<void> {
    const { rawLrc, translation } = await fetchLyricFromSearchResult(lyricItem);

    if (musicItem.platform === WEBDAV_MUSIC_PLUGIN_PLATFORM) {
        await saveToWebdavSidecar(musicItem, rawLrc, translation);
        await clearStaleLinkedLyricIfNeeded(musicItem);
        return;
    }

    if (isDownloaded(musicItem)) {
        await saveToLocalDownloadSidecar(musicItem, rawLrc, translation);
        await linkLyric(musicItem, lyricItem);
        return;
    }

    await linkLyric(musicItem, lyricItem);
}
