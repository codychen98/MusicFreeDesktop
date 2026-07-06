import logger from "@shared/logger/main";
import {
    getRemoteTextForPlayback,
    remoteExistsForPlayback,
} from "@shared/remote-storage/playback-client";
import { remotePathsForWebdavTrack } from "@/common/webdav-download-path";

import { getRemoteMusicClient } from "./upload-impl";
import type {
    FetchRemoteSidecarLyricsResult,
    UploadRemoteSidecarLyricsInput,
} from "./types";

async function readRemoteTextIfExists(
    remotePath: string,
): Promise<string | undefined> {
    if (!(await remoteExistsForPlayback(remotePath))) {
        return undefined;
    }
    const contents = await getRemoteTextForPlayback(remotePath);
    if (!contents.trim()) {
        return undefined;
    }
    return contents;
}

export async function fetchRemoteSidecarLyrics(
    remoteAudioPath: string,
): Promise<FetchRemoteSidecarLyricsResult> {
    const normalizedPath = remoteAudioPath?.trim();
    if (!normalizedPath) {
        return {};
    }

    const paths = remotePathsForWebdavTrack(normalizedPath);

    try {
        const rawLrc = await readRemoteTextIfExists(paths.lrcPath);
        const translation = await readRemoteTextIfExists(paths.tranLrcPath);
        return {
            ...(rawLrc !== undefined ? { rawLrc } : {}),
            ...(translation !== undefined ? { translation } : {}),
        };
    } catch (e: unknown) {
        const err = e instanceof Error ? e : new Error(String(e));
        logger.logError("Remote music fetch sidecar lyrics failed", err, {
            remoteAudioPath: normalizedPath,
        });
        throw e;
    }
}

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

    const client = await getRemoteMusicClient();
    const paths = remotePathsForWebdavTrack(remoteAudioPath);

    try {
        await client.putText(paths.lrcPath, rawLrc);

        const translation = input.translation?.trim();
        if (translation) {
            await client.putText(paths.tranLrcPath, translation);
        }
    } catch (e: unknown) {
        const err = e instanceof Error ? e : new Error(String(e));
        logger.logError("Remote music upload sidecar lyrics failed", err, {
            remoteAudioPath,
        });
        throw e;
    }
}
