import logger from "@shared/logger/main";
import type { RemoteStorageClient } from "@shared/remote-storage/types";
import { remotePathsForWebdavTrack } from "@/common/webdav-download-path";

import { getRemoteMusicClient } from "./upload-impl";
import type { RenameWebdavRemoteTrackInput } from "./types";

async function assertRenameTargetsAvailable(
    client: RemoteStorageClient,
    oldPaths: ReturnType<typeof remotePathsForWebdavTrack>,
    newPaths: ReturnType<typeof remotePathsForWebdavTrack>,
): Promise<void> {
    if (await client.exists(newPaths.audioPath)) {
        throw new Error("WEBDAV_RENAME_TARGET_EXISTS");
    }

    if (await client.exists(oldPaths.lrcPath)) {
        if (await client.exists(newPaths.lrcPath)) {
            throw new Error("WEBDAV_RENAME_TARGET_EXISTS");
        }
    }

    if (await client.exists(oldPaths.tranLrcPath)) {
        if (await client.exists(newPaths.tranLrcPath)) {
            throw new Error("WEBDAV_RENAME_TARGET_EXISTS");
        }
    }
}

async function moveRemoteFileIfExists(
    client: RemoteStorageClient,
    oldPath: string,
    newPath: string,
): Promise<void> {
    if (!(await client.exists(oldPath))) {
        return;
    }
    await client.moveFile(oldPath, newPath);
}

export async function renameWebdavRemoteTrack(
    input: RenameWebdavRemoteTrackInput,
): Promise<void> {
    const oldRemoteAudioPath = input.oldRemoteAudioPath?.trim();
    const newRemoteAudioPath = input.newRemoteAudioPath?.trim();
    if (!oldRemoteAudioPath || !newRemoteAudioPath) {
        throw new Error("WEBDAV_REMOTE_PATH_MISSING");
    }

    if (oldRemoteAudioPath === newRemoteAudioPath) {
        return;
    }

    const client = getRemoteMusicClient();
    const oldPaths = remotePathsForWebdavTrack(oldRemoteAudioPath);
    const newPaths = remotePathsForWebdavTrack(newRemoteAudioPath);

    if (!(await client.exists(oldPaths.audioPath))) {
        throw new Error("WEBDAV_REMOTE_SOURCE_MISSING");
    }

    await assertRenameTargetsAvailable(client, oldPaths, newPaths);

    try {
        await client.moveFile(oldPaths.audioPath, newPaths.audioPath);
        await moveRemoteFileIfExists(client, oldPaths.lrcPath, newPaths.lrcPath);
        await moveRemoteFileIfExists(
            client,
            oldPaths.tranLrcPath,
            newPaths.tranLrcPath,
        );
    } catch (e: unknown) {
        const err = e instanceof Error ? e : new Error(String(e));
        logger.logError("Remote music rename track failed", err, {
            oldRemoteAudioPath,
            newRemoteAudioPath,
        });
        throw e;
    }
}
