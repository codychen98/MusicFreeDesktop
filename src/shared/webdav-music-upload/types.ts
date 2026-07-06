export class RemoteMusicConfigIncompleteError extends Error {
    constructor() {
        super("REMOTE_MUSIC_CONFIG_INCOMPLETE");
        this.name = "RemoteMusicConfigIncompleteError";
    }
}

/** @deprecated Use `RemoteMusicConfigIncompleteError` */
export class WebdavMusicPluginConfigIncompleteError extends RemoteMusicConfigIncompleteError {
    constructor() {
        super();
        this.name = "WebdavMusicPluginConfigIncompleteError";
    }
}

export interface RemoteMusicConfig {
    musicPath: string;
    remoteDir: string;
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
    /** Full remote path resolved from remote music config and `audioFilename`. */
    remoteAudioPath: string;
    exists: boolean;
}

export interface DeleteWebdavRemoteTrackInput {
    /** Full remote audio path (`musicItem.id` for WebDAV rows). */
    remoteAudioPath: string;
}

export interface RenameWebdavRemoteTrackInput {
    /** Current full remote audio path (`musicItem.id` for WebDAV rows). */
    oldRemoteAudioPath: string;
    /** Destination full remote audio path (same directory, new basename). */
    newRemoteAudioPath: string;
}

export interface UploadRemoteSidecarLyricsInput {
    /** Full remote audio path (`musicItem.id` for WebDAV rows). */
    remoteAudioPath: string;
    rawLrc: string;
    translation?: string | null;
}

export interface FetchRemoteSidecarLyricsResult {
    rawLrc?: string;
    translation?: string;
}
