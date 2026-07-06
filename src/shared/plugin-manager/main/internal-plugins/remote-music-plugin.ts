import { remoteMusicPluginHash, remoteMusicPluginName } from "@/common/constant";
import { parseDownloadBasename } from "@/common/download-filename";
import AppConfig from "@shared/app-config/main";
import { getRemoteMusicPath, getRemoteStorageCredentialsFromConfig } from "@shared/remote-storage/remote-config";
import { resolveRemoteTransport } from "@shared/remote-storage/resolve";
import type { RemoteDirectoryEntry, RemoteStorageClient } from "@shared/remote-storage/types";
import { getRemoteMusicClient } from "@shared/webdav-music-upload/upload-impl";

import { Plugin } from "../plugin";

const AUDIO_EXT = [
    ".mp3",
    ".flac",
    ".wma",
    ".wav",
    ".m4a",
    ".ogg",
    ".acc",
    ".aac",
    ".ape",
    ".opus",
];

function isAudioFile(entry: RemoteDirectoryEntry): boolean {
    if (entry.type !== "file") {
        return false;
    }
    if (entry.mime?.startsWith("audio")) {
        return true;
    }
    const name = entry.basename.toLowerCase();
    return AUDIO_EXT.some((ext) => name.endsWith(ext));
}

function fileEntryToMusicItem(entry: RemoteDirectoryEntry): IMusic.IMusicItem {
    const basename = entry.basename;
    const lastDot = basename.lastIndexOf(".");
    const withoutExt = lastDot === -1 ? basename : basename.slice(0, lastDot);
    const parsed = parseDownloadBasename(withoutExt);
    if (parsed) {
        return {
            title: parsed.title,
            id: entry.path,
            artist: parsed.artist,
            album: "未知专辑",
        };
    }
    return {
        title: withoutExt || basename,
        id: entry.path,
        artist: "未知作者",
        album: "未知专辑",
    };
}

function parseMusicPathSegments(musicPath: string): string[] {
    if (!musicPath.trim()) {
        return [];
    }
    return musicPath
        .split(",")
        .map((segment) => segment.trim())
        .filter(Boolean);
}

let cachedFileList: RemoteDirectoryEntry[] | null = null;
let cachedFileListKey = "";

function buildFileListCacheKey(): string {
    const config = AppConfig.getAllConfig();
    const musicPath = getRemoteMusicPath(config);
    const creds = getRemoteStorageCredentialsFromConfig(config);
    const transport = resolveRemoteTransport(creds);
    return `${transport ?? ""}\0${musicPath}\0${JSON.stringify(creds)}`;
}

async function loadCachedAudioFiles(): Promise<RemoteDirectoryEntry[]> {
    const key = buildFileListCacheKey();
    if (cachedFileList && cachedFileListKey === key) {
        return cachedFileList;
    }

    const musicPath = getRemoteMusicPath(AppConfig.getAllConfig());
    const segments = parseMusicPathSegments(musicPath);
    if (!segments.length) {
        cachedFileList = [];
        cachedFileListKey = key;
        return [];
    }

    let client: RemoteStorageClient;
    try {
        client = getRemoteMusicClient();
    } catch {
        cachedFileList = [];
        cachedFileListKey = key;
        return [];
    }

    const result: RemoteDirectoryEntry[] = [];
    for (const searchPath of segments) {
        try {
            const items = await client.listDirectory(searchPath);
            result.push(...items.filter(isAudioFile));
        } catch {
            // Ignore per-root listing failures (parity with external WebDAV plugin).
        }
    }

    cachedFileList = result;
    cachedFileListKey = key;
    return result;
}

function remoteMusicPluginDefine(): IPlugin.IPluginInstance {
    return {
        platform: remoteMusicPluginName,
        supportedSearchType: ["music"],
        _path: "",
        async search(query, _page, type) {
            if (type !== "music") {
                return { isEnd: true, data: [] };
            }
            const files = await loadCachedAudioFiles();
            return {
                isEnd: true,
                data: files
                    .filter((entry) => entry.basename.includes(query))
                    .map(fileEntryToMusicItem),
            };
        },
        async getTopLists() {
            const musicPath = getRemoteMusicPath(AppConfig.getAllConfig());
            const segments = parseMusicPathSegments(musicPath);
            if (!segments.length) {
                return [];
            }
            try {
                getRemoteMusicClient();
            } catch {
                return [];
            }
            return [
                {
                    title: "全部歌曲",
                    data: segments.map((segment) => ({
                        title: segment,
                        id: segment,
                    })),
                },
            ];
        },
        async getTopListDetail(topListItem) {
            let client: RemoteStorageClient;
            try {
                client = getRemoteMusicClient();
            } catch {
                return { musicList: [] };
            }
            try {
                const fileItems = (
                    await client.listDirectory(topListItem.id)
                ).filter(isAudioFile);
                return {
                    musicList: fileItems.map(fileEntryToMusicItem),
                };
            } catch {
                return { musicList: [] };
            }
        },
        async getMediaSource(musicItem) {
            const client = getRemoteMusicClient();
            const url = await client.getDownloadUrl(musicItem.id);
            return { url };
        },
    };
}

const remoteMusicPlugin = new Plugin(remoteMusicPluginDefine, "");
remoteMusicPlugin.hash = remoteMusicPluginHash;
export default remoteMusicPlugin;
