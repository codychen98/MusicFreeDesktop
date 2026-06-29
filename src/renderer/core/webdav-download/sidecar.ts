import type {
    FetchRemoteSidecarLyricsResult,
    UploadRemoteSidecarLyricsInput,
} from "@shared/webdav-music-upload/types";

export type {
    FetchRemoteSidecarLyricsResult,
    UploadRemoteSidecarLyricsInput,
};

interface IWebdavMusicUploadBridge {
    uploadRemoteSidecarLyrics: (
        input: UploadRemoteSidecarLyricsInput,
    ) => Promise<void>;
    fetchRemoteSidecarLyrics: (
        remoteAudioPath: string,
    ) => Promise<FetchRemoteSidecarLyricsResult>;
}

const bridge = window[
    "@shared/webdav-music-upload" as keyof Window
] as unknown as IWebdavMusicUploadBridge;

export async function uploadRemoteSidecarLyrics(
    input: UploadRemoteSidecarLyricsInput,
): Promise<void> {
    const remoteAudioPath = input.remoteAudioPath?.trim();
    const rawLrc = input.rawLrc?.trim();
    if (!remoteAudioPath) {
        throw new Error("WEBDAV_REMOTE_PATH_MISSING");
    }
    if (!rawLrc) {
        throw new Error("LYRIC_EMPTY");
    }
    await bridge.uploadRemoteSidecarLyrics({
        remoteAudioPath,
        rawLrc,
        translation: input.translation?.trim() || null,
    });
}

export async function fetchRemoteSidecarLyrics(
    remoteAudioPath: string,
): Promise<FetchRemoteSidecarLyricsResult> {
    const normalizedPath = remoteAudioPath?.trim();
    if (!normalizedPath) {
        return {};
    }
    return bridge.fetchRemoteSidecarLyrics(normalizedPath);
}
