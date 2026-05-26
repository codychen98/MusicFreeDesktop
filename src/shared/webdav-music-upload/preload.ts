import { contextBridge, ipcRenderer } from "electron";

import type {
    DeleteWebdavRemoteTrackInput,
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
    deleteWebdavRemoteTrack: (
        input: DeleteWebdavRemoteTrackInput,
    ): Promise<void> =>
        ipcRenderer.invoke(
            "@shared/webdav-music-upload/delete-remote-track",
            input,
        ),
};

contextBridge.exposeInMainWorld("@shared/webdav-music-upload", mod);
