import fs from "fs/promises";
import { AuthType, createClient, type WebDAVClient } from "webdav";
import AppConfig from "@shared/app-config/main";
import logger from "@shared/logger/main";
import {
    lyricSidecarFilename,
    remotePathFor,
    resolveRemoteDir,
    translationSidecarFilename,
} from "@/common/webdav-download-path";

import {
    WebdavMusicPluginConfigIncompleteError,
    type UploadDownloadArtifactsInput,
    type UploadDownloadArtifactsResult,
} from "./types";

export type {
    UploadDownloadArtifactsInput,
    UploadDownloadArtifactsResult,
} from "./types";

export { WebdavMusicPluginConfigIncompleteError } from "./types";

export const WEBDAV_MUSIC_PLUGIN_PLATFORM = "WebDAV" as const;

interface WebdavMusicPluginConfig {
    url: string;
    username: string;
    password: string;
    searchPath: string;
    remoteDir: string;
}

function getWebdavMusicPluginUserVariables(): Record<string, string> {
    const meta = AppConfig.getConfig("private.pluginMeta") ?? {};
    return meta[WEBDAV_MUSIC_PLUGIN_PLATFORM]?.userVariables ?? {};
}

export function getWebdavMusicPluginConfig(): WebdavMusicPluginConfig {
    const vars = getWebdavMusicPluginUserVariables();
    const url = vars.url?.trim() ?? "";
    const username = vars.username?.trim() ?? "";
    const password = vars.password?.trim() ?? "";
    const searchPath = vars.searchPath?.trim() ?? "";
    const remoteDir = resolveRemoteDir(searchPath);
    if (!url || !username || !password || !remoteDir) {
        throw new WebdavMusicPluginConfigIncompleteError();
    }
    return { url, username, password, searchPath, remoteDir };
}

let cachedClient: WebDAVClient | null = null;
let cachedClientKey = "";

function getWebdavMusicClient(config: WebdavMusicPluginConfig): WebDAVClient {
    const key = `${config.url}\0${config.username}\0${config.password}`;
    if (cachedClient && cachedClientKey === key) {
        return cachedClient;
    }
    cachedClient = createClient(config.url, {
        authType: AuthType.Password,
        username: config.username,
        password: config.password,
    });
    cachedClientKey = key;
    return cachedClient;
}

async function ensureRemoteDirectory(
    client: WebDAVClient,
    remoteDir: string,
): Promise<void> {
    if (!(await client.exists(remoteDir))) {
        await client.createDirectory(remoteDir, { recursive: true });
    }
}

type UploadFileMode = "binary" | "text";

async function uploadFile(
    config: WebdavMusicPluginConfig,
    client: WebDAVClient,
    localPath: string,
    remotePath: string,
    mode: UploadFileMode,
): Promise<void> {
    const payload =
        mode === "text"
            ? await fs.readFile(localPath, "utf8")
            : await fs.readFile(localPath);

    await client.putFileContents(remotePath, payload, {
        overwrite: true,
    });
}

export async function uploadDownloadArtifacts(
    input: UploadDownloadArtifactsInput,
): Promise<UploadDownloadArtifactsResult> {
    const config = getWebdavMusicPluginConfig();
    const client = getWebdavMusicClient(config);
    await ensureRemoteDirectory(client, config.remoteDir);

    const remoteAudioPath = remotePathFor(config.remoteDir, input.audioFilename);
    let audioSkipped = false;

    try {
        if (await client.exists(remoteAudioPath)) {
            audioSkipped = true;
        } else {
            await uploadFile(
                config,
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
                    config,
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
                    config,
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
        logger.logError("WebDAV upload download artifacts failed", err, {
            remoteAudioPath,
            audioFilename: input.audioFilename,
        });
        throw e;
    }
}
