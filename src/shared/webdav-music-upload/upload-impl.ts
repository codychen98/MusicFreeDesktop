import fs from "fs/promises";
import AppConfig from "@shared/app-config/main";
import logger from "@shared/logger/main";
import {
    getRemoteMusicPath,
    getRemoteStorageCredentialsFromConfig,
    isRemoteCredentialsCompleteInConfig,
} from "@shared/remote-storage/remote-config";
import {
    createRemoteStorageClient,
    resolveRemoteTransport,
} from "@shared/remote-storage/resolve";
import type { RemoteStorageClient } from "@shared/remote-storage/types";
import {
    lyricSidecarFilename,
    remotePathFor,
    resolveRemoteDir,
    translationSidecarFilename,
} from "@/common/webdav-download-path";

import {
    RemoteMusicConfigIncompleteError,
    type RemoteAudioExistsInput,
    type RemoteAudioExistsResult,
    type RemoteMusicConfig,
    type UploadDownloadArtifactsInput,
    type UploadDownloadArtifactsResult,
} from "./types";

export type {
    RemoteAudioExistsInput,
    RemoteAudioExistsResult,
    RemoteMusicConfig,
    UploadDownloadArtifactsInput,
    UploadDownloadArtifactsResult,
} from "./types";

export {
    RemoteMusicConfigIncompleteError,
    WebdavMusicPluginConfigIncompleteError,
} from "./types";

export const WEBDAV_MUSIC_PLUGIN_PLATFORM = "WebDAV" as const;

let cachedClient: RemoteStorageClient | null = null;
let cachedClientKey = "";

function buildRemoteMusicClientCacheKey(): string {
    const config = AppConfig.getAllConfig();
    const creds = getRemoteStorageCredentialsFromConfig(config);
    const transport = resolveRemoteTransport(creds);
    if (transport === "pcloud") {
        const pcloud = creds.pcloud!;
        return `pcloud\0${pcloud.hostname}\0${pcloud.tokenJson}`;
    }
    if (transport === "webdav") {
        const webdav = creds.webdav!;
        return `webdav\0${webdav.url}\0${webdav.rootPath ?? ""}\0${webdav.username}\0${webdav.password}`;
    }
    return "";
}

export function getRemoteMusicConfig(): RemoteMusicConfig {
    const config = AppConfig.getAllConfig();
    const musicPath = getRemoteMusicPath(config);
    const remoteDir = resolveRemoteDir(musicPath);
    if (!isRemoteCredentialsCompleteInConfig(config) || !remoteDir) {
        throw new RemoteMusicConfigIncompleteError();
    }
    return { musicPath, remoteDir };
}

export function getRemoteMusicClient(): RemoteStorageClient {
    const key = buildRemoteMusicClientCacheKey();
    if (!key) {
        throw new RemoteMusicConfigIncompleteError();
    }
    if (cachedClient && cachedClientKey === key) {
        return cachedClient;
    }
    const config = AppConfig.getAllConfig();
    cachedClient = createRemoteStorageClient(
        getRemoteStorageCredentialsFromConfig(config),
    );
    cachedClientKey = key;
    return cachedClient;
}

type UploadFileMode = "binary" | "text";

async function uploadFile(
    client: RemoteStorageClient,
    localPath: string,
    remotePath: string,
    mode: UploadFileMode,
): Promise<void> {
    if (mode === "text") {
        const payload = await fs.readFile(localPath, "utf8");
        await client.putText(remotePath, payload);
        return;
    }
    const payload = await fs.readFile(localPath);
    await client.putBinary(remotePath, payload);
}

export async function uploadDownloadArtifacts(
    input: UploadDownloadArtifactsInput,
): Promise<UploadDownloadArtifactsResult> {
    const config = getRemoteMusicConfig();
    const client = getRemoteMusicClient();
    await client.ensureDir(config.remoteDir);

    const remoteAudioPath = remotePathFor(config.remoteDir, input.audioFilename);
    let audioSkipped = false;

    try {
        if (await client.exists(remoteAudioPath)) {
            audioSkipped = true;
        } else {
            await uploadFile(
                client,
                input.localAudioPath,
                remoteAudioPath,
                "binary",
            );
        }

        let lrcUploaded = false;
        let tranLrcUploaded = false;

        if (input.localLrcPath) {
            const remoteLrc = remotePathFor(
                config.remoteDir,
                lyricSidecarFilename(input.audioFilename),
            );
            if (!(await client.exists(remoteLrc))) {
                await uploadFile(
                    client,
                    input.localLrcPath,
                    remoteLrc,
                    "text",
                );
                lrcUploaded = true;
            }
        }

        if (input.localTranLrcPath) {
            const remoteTran = remotePathFor(
                config.remoteDir,
                translationSidecarFilename(input.audioFilename),
            );
            if (!(await client.exists(remoteTran))) {
                await uploadFile(
                    client,
                    input.localTranLrcPath,
                    remoteTran,
                    "text",
                );
                tranLrcUploaded = true;
            }
        }

        return {
            remoteAudioPath,
            audioSkipped,
            lrcUploaded,
            tranLrcUploaded,
        };
    } catch (e: unknown) {
        const err = e instanceof Error ? e : new Error(String(e));
        logger.logError("Remote music upload download artifacts failed", err, {
            remoteAudioPath,
            audioFilename: input.audioFilename,
        });
        throw e;
    }
}

export async function remoteAudioExists(
    input: RemoteAudioExistsInput,
): Promise<RemoteAudioExistsResult> {
    const config = getRemoteMusicConfig();
    const client = getRemoteMusicClient();
    const remoteAudioPath = remotePathFor(config.remoteDir, input.audioFilename);
    const exists = await client.exists(remoteAudioPath);
    return {
        remoteAudioPath,
        exists,
    };
}
