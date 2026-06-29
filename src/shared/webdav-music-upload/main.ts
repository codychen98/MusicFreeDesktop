import { ipcMain } from "electron";

import { deleteWebdavRemoteTrack } from "./delete-impl";
import { renameWebdavRemoteTrack } from "./rename-impl";
import {
    fetchRemoteSidecarLyrics,
    uploadRemoteSidecarLyrics,
} from "./sidecar-impl";
import { remoteAudioExists, uploadDownloadArtifacts } from "./upload-impl";
import type {
    DeleteWebdavRemoteTrackInput,
    RemoteAudioExistsInput,
    RenameWebdavRemoteTrackInput,
    UploadDownloadArtifactsInput,
    UploadRemoteSidecarLyricsInput,
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
        ipcMain.handle(
            "@shared/webdav-music-upload/rename-remote-track",
            async (_evt, input: RenameWebdavRemoteTrackInput) =>
                renameWebdavRemoteTrack(input),
        );
        ipcMain.handle(
            "@shared/webdav-music-upload/upload-remote-sidecar-lyrics",
            async (_evt, input: UploadRemoteSidecarLyricsInput) =>
                uploadRemoteSidecarLyrics(input),
        );
        ipcMain.handle(
            "@shared/webdav-music-upload/fetch-remote-sidecar-lyrics",
            async (_evt, remoteAudioPath: string) =>
                fetchRemoteSidecarLyrics(remoteAudioPath),
        );
    }
}

export default new WebdavMusicUploadMain();
