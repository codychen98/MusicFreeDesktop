import logger from "@shared/logger/main";
import type { RemoteStorageClient } from "@shared/remote-storage/types";
import { remotePathsForWebdavTrack } from "@/common/webdav-download-path";

import { getRemoteMusicClient } from "./upload-impl";
import type { DeleteWebdavRemoteTrackInput } from "./types";

async function deleteRemoteFileIfExists(
    client: RemoteStorageClient,
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

    const client = getRemoteMusicClient();
    const paths = remotePathsForWebdavTrack(remoteAudioPath);

    try {
        await deleteRemoteFileIfExists(client, paths.audioPath);
        await deleteRemoteFileIfExists(client, paths.lrcPath);
        await deleteRemoteFileIfExists(client, paths.tranLrcPath);
    } catch (e: unknown) {
        const err = e instanceof Error ? e : new Error(String(e));
        logger.logError("Remote music delete track failed", err, {
            remoteAudioPath,
        });
        throw e;
    }
}
