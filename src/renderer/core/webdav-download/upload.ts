import type {
    UploadDownloadArtifactsInput,
    UploadDownloadArtifactsResult,
} from "@shared/webdav-music-upload/types";

export type {
    UploadDownloadArtifactsInput,
    UploadDownloadArtifactsResult,
};

export { WebdavMusicPluginConfigIncompleteError } from "@shared/webdav-music-upload/types";

interface IWebdavMusicUploadBridge {
    uploadDownloadArtifacts: (
        input: UploadDownloadArtifactsInput,
    ) => Promise<UploadDownloadArtifactsResult>;
}

const bridge = window[
    "@shared/webdav-music-upload" as keyof Window
] as unknown as IWebdavMusicUploadBridge;

export async function uploadDownloadArtifacts(
    input: UploadDownloadArtifactsInput,
): Promise<UploadDownloadArtifactsResult> {
    return bridge.uploadDownloadArtifacts(input);
}
