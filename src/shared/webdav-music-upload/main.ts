import { ipcMain } from "electron";

import { uploadDownloadArtifacts } from "./upload-impl";
import type { UploadDownloadArtifactsInput } from "./types";

class WebdavMusicUploadMain {
    setup() {
        ipcMain.handle(
            "@shared/webdav-music-upload/upload-download-artifacts",
            async (
                _evt,
                input: UploadDownloadArtifactsInput,
            ) => uploadDownloadArtifacts(input),
        );
    }
}

export default new WebdavMusicUploadMain();
