import type { RenameWebdavRemoteTrackInput } from "@shared/webdav-music-upload/types";

interface IWebdavMusicUploadBridge {
    renameWebdavRemoteTrack: (
        input: RenameWebdavRemoteTrackInput,
    ) => Promise<void>;
}

const bridge = window[
    "@shared/webdav-music-upload" as keyof Window
] as unknown as IWebdavMusicUploadBridge;

export async function renameWebdavRemoteTrack(
    input: RenameWebdavRemoteTrackInput,
): Promise<void> {
    const oldRemoteAudioPath = input.oldRemoteAudioPath?.trim();
    const newRemoteAudioPath = input.newRemoteAudioPath?.trim();
    if (!oldRemoteAudioPath || !newRemoteAudioPath) {
        throw new Error("WEBDAV_REMOTE_PATH_MISSING");
    }
    await bridge.renameWebdavRemoteTrack({
        oldRemoteAudioPath,
        newRemoteAudioPath,
    });
}
