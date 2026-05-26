import type { WebDAVClient } from "webdav";
import logger from "@shared/logger/main";
import { remotePathsForWebdavTrack } from "@/common/webdav-download-path";

import {
    getWebdavMusicPluginConfig,
    getWebdavMusicClient,
} from "./upload-impl";
import type { DeleteWebdavRemoteTrackInput } from "./types";

async function deleteRemoteFileIfExists(
    client: WebDAVClient,
    remotePath: string,
): Promise<void> {
    if (!(await client.exists(remotePath))) {
        return;
    }
    await client.deleteFile(remotePath);
}

export async function deleteWebdavRemoteTrack(
    input: DeleteWebdavRemoteTrackInput,
): Promise<void> {
    const remoteAudioPath = input.remoteAudioPath?.trim();
    if (!remoteAudioPath) {
        throw new Error("WEBDAV_REMOTE_PATH_MISSING");
    }

    const config = getWebdavMusicPluginConfig();
    const client = getWebdavMusicClient(config);
    const paths = remotePathsForWebdavTrack(remoteAudioPath);

    try {
        await deleteRemoteFileIfExists(client, paths.audioPath);
        await deleteRemoteFileIfExists(client, paths.lrcPath);
        await deleteRemoteFileIfExists(client, paths.tranLrcPath);
    } catch (e: unknown) {
        const err = e instanceof Error ? e : new Error(String(e));
        logger.logError("WebDAV delete remote track failed", err, {
            remoteAudioPath,
        });
        throw e;
    }
}
