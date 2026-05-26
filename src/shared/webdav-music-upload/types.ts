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
