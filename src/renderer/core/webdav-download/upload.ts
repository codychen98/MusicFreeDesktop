import type {
    RemoteAudioExistsInput,
    RemoteAudioExistsResult,
    UploadDownloadArtifactsInput,
    UploadDownloadArtifactsResult,
} from "@shared/webdav-music-upload/types";

export type {
    RemoteAudioExistsInput,
    RemoteAudioExistsResult,
    UploadDownloadArtifactsInput,
    UploadDownloadArtifactsResult,
};

export { WebdavMusicPluginConfigIncompleteError } from "@shared/webdav-music-upload/types";

interface IWebdavMusicUploadBridge {
    uploadDownloadArtifacts: (
        input: UploadDownloadArtifactsInput,
    ) => Promise<UploadDownloadArtifactsResult>;
    remoteAudioExists: (
        input: RemoteAudioExistsInput,
    ) => Promise<RemoteAudioExistsResult>;
}

const bridge = window[
    "@shared/webdav-music-upload" as keyof Window
] as unknown as IWebdavMusicUploadBridge;

export async function uploadDownloadArtifacts(
    input: UploadDownloadArtifactsInput,
): Promise<UploadDownloadArtifactsResult> {
    return bridge.uploadDownloadArtifacts(input);
}

export async function remoteAudioExists(
    input: RemoteAudioExistsInput,
): Promise<RemoteAudioExistsResult> {
    return bridge.remoteAudioExists(input);
}
