export class WebdavMusicPluginConfigIncompleteError extends Error {
    constructor() {
        super("WEBDAV_MUSIC_PLUGIN_CONFIG_INCOMPLETE");
        this.name = "WebdavMusicPluginConfigIncompleteError";
    }
}

export interface UploadDownloadArtifactsInput {
    localAudioPath: string;
    audioFilename: string;
    localLrcPath?: string | null;
    localTranLrcPath?: string | null;
}

export interface UploadDownloadArtifactsResult {
    remoteAudioPath: string;
    audioSkipped: boolean;
    lrcUploaded: boolean;
    tranLrcUploaded: boolean;
}

export interface RemoteAudioExistsInput {
    /** Basename only, e.g. `title@artist.flac`. */
    audioFilename: string;
}

export interface RemoteAudioExistsResult {
    /** Full remote path resolved from plugin config and `audioFilename`. */
    remoteAudioPath: string;
    exists: boolean;
}

export interface DeleteWebdavRemoteTrackInput {
    /** Full remote audio path (`musicItem.id` for WebDAV rows). */
    remoteAudioPath: string;
}
