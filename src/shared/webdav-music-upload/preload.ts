import { contextBridge, ipcRenderer } from "electron";

import type {
    DeleteWebdavRemoteTrackInput,
    RemoteAudioExistsInput,
    RemoteAudioExistsResult,
    RenameWebdavRemoteTrackInput,
    UploadDownloadArtifactsInput,
    UploadDownloadArtifactsResult,
} from "./types";

const mod = {
    uploadDownloadArtifacts: (
        input: UploadDownloadArtifactsInput,
    ): Promise<UploadDownloadArtifactsResult> =>
        ipcRenderer.invoke(
            "@shared/webdav-music-upload/upload-download-artifacts",
            input,
        ),
    remoteAudioExists: (
        input: RemoteAudioExistsInput,
    ): Promise<RemoteAudioExistsResult> =>
        ipcRenderer.invoke(
            "@shared/webdav-music-upload/remote-audio-exists",
            input,
        ),
    deleteWebdavRemoteTrack: (
        input: DeleteWebdavRemoteTrackInput,
    ): Promise<void> =>
        ipcRenderer.invoke(
            "@shared/webdav-music-upload/delete-remote-track",
            input,
        ),
    renameWebdavRemoteTrack: (
        input: RenameWebdavRemoteTrackInput,
    ): Promise<void> =>
        ipcRenderer.invoke(
            "@shared/webdav-music-upload/rename-remote-track",
            input,
        ),
};

contextBridge.exposeInMainWorld("@shared/webdav-music-upload", mod);
