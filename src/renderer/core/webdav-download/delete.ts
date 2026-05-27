import type { DeleteWebdavRemoteTrackInput } from "@shared/webdav-music-upload/types";

interface IWebdavMusicUploadBridge {
    deleteWebdavRemoteTrack: (
        input: DeleteWebdavRemoteTrackInput,
    ) => Promise<void>;
}

const bridge = window[
    "@shared/webdav-music-upload" as keyof Window
] as unknown as IWebdavMusicUploadBridge;

export async function deleteWebdavRemoteTrack(
    musicItem: IMusic.IMusicItem,
): Promise<void> {
    const remoteAudioPath = musicItem.id?.trim();
    if (!remoteAudioPath) {
        throw new Error("WEBDAV_REMOTE_PATH_MISSING");
    }
    await bridge.deleteWebdavRemoteTrack({ remoteAudioPath });
}
