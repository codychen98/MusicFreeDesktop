import type { WebDAVClient } from "webdav";
import logger from "@shared/logger/main";
import { remotePathsForWebdavTrack } from "@/common/webdav-download-path";

import {
    getWebdavMusicPluginConfig,
    getWebdavMusicClient,
} from "./upload-impl";
import type {
    FetchRemoteSidecarLyricsResult,
    UploadRemoteSidecarLyricsInput,
} from "./types";

async function readRemoteTextIfExists(
    client: WebDAVClient,
    remotePath: string,
): Promise<string | undefined> {
    if (!(await client.exists(remotePath))) {
        return undefined;
    }
    const contents = await client.getFileContents(remotePath, {
        format: "text",
    });
    if (typeof contents !== "string" || !contents.trim()) {
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

    const config = getWebdavMusicPluginConfig();
    const client = getWebdavMusicClient(config);
    const paths = remotePathsForWebdavTrack(normalizedPath);

    try {
        const rawLrc = await readRemoteTextIfExists(client, paths.lrcPath);
        const translation = await readRemoteTextIfExists(
            client,
            paths.tranLrcPath,
        );
        return {
            ...(rawLrc !== undefined ? { rawLrc } : {}),
            ...(translation !== undefined ? { translation } : {}),
        };
    } catch (e: unknown) {
        const err = e instanceof Error ? e : new Error(String(e));
        logger.logError("WebDAV fetch remote sidecar lyrics failed", err, {
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

    const config = getWebdavMusicPluginConfig();
    const client = getWebdavMusicClient(config);
    const paths = remotePathsForWebdavTrack(remoteAudioPath);

    try {
        await client.putFileContents(paths.lrcPath, rawLrc, {
            overwrite: true,
        });

        const translation = input.translation?.trim();
        if (translation) {
            await client.putFileContents(paths.tranLrcPath, translation, {
                overwrite: true,
            });
        }
    } catch (e: unknown) {
        const err = e instanceof Error ? e : new Error(String(e));
        logger.logError("WebDAV upload remote sidecar lyrics failed", err, {
            remoteAudioPath,
        });
        throw e;
    }
}
