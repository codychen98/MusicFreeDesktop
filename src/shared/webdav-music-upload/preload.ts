import { contextBridge, ipcRenderer } from "electron";

import type {
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
};

contextBridge.exposeInMainWorld("@shared/webdav-music-upload", mod);
