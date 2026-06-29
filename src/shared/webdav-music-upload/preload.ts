import { contextBridge, ipcRenderer } from "electron";

import type {
    DeleteWebdavRemoteTrackInput,
    FetchRemoteSidecarLyricsResult,
    RemoteAudioExistsInput,
    RemoteAudioExistsResult,
    RenameWebdavRemoteTrackInput,
    UploadDownloadArtifactsInput,
    UploadDownloadArtifactsResult,
    UploadRemoteSidecarLyricsInput,
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
    uploadRemoteSidecarLyrics: (
        input: UploadRemoteSidecarLyricsInput,
    ): Promise<void> =>
        ipcRenderer.invoke(
            "@shared/webdav-music-upload/upload-remote-sidecar-lyrics",
            input,
        ),
    fetchRemoteSidecarLyrics: (
        remoteAudioPath: string,
    ): Promise<FetchRemoteSidecarLyricsResult> =>
        ipcRenderer.invoke(
            "@shared/webdav-music-upload/fetch-remote-sidecar-lyrics",
            remoteAudioPath,
        ),
};

contextBridge.exposeInMainWorld("@shared/webdav-music-upload", mod);
