import { ipcMain } from "electron";

import { deleteWebdavRemoteTrack } from "./delete-impl";
import { remoteAudioExists, uploadDownloadArtifacts } from "./upload-impl";
import type {
    DeleteWebdavRemoteTrackInput,
    RemoteAudioExistsInput,
    UploadDownloadArtifactsInput,
} from "./types";

class WebdavMusicUploadMain {
    setup() {
        ipcMain.handle(
            "@shared/webdav-music-upload/upload-download-artifacts",
            async (
                _evt,
                input: UploadDownloadArtifactsInput,
            ) => uploadDownloadArtifacts(input),
        );
        ipcMain.handle(
            "@shared/webdav-music-upload/remote-audio-exists",
            async (_evt, input: RemoteAudioExistsInput) =>
                remoteAudioExists(input),
        );
        ipcMain.handle(
            "@shared/webdav-music-upload/delete-remote-track",
            async (_evt, input: DeleteWebdavRemoteTrackInput) =>
                deleteWebdavRemoteTrack(input),
        );
    }
}

export default new WebdavMusicUploadMain();
