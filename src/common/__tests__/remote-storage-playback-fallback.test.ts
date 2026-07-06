import { shouldUseWebdavPlaybackFallback } from "../../shared/remote-storage/resolve";
import type { RemoteStorageClient } from "../../shared/remote-storage/types";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function createMockClient(handlers: {
    exists?: (path: string) => Promise<boolean>;
    getText?: (path: string) => Promise<string>;
    getDownloadUrl?: (path: string) => Promise<string>;
}): RemoteStorageClient {
    return {
        exists: handlers.exists ?? (async () => false),
        getText: handlers.getText ?? (async () => ""),
        getBinary: async () => Buffer.alloc(0),
        putText: async () => {},
        putBinary: async () => {},
        ensureDir: async () => {},
        deleteFile: async () => {},
        moveFile: async () => {},
        listDirectory: async () => [],
        getDownloadUrl:
            handlers.getDownloadUrl ?? (async () => "https://example.test/file"),
    };
}

async function runFallbackHelperTests(): Promise<void> {
    assert(
        shouldUseWebdavPlaybackFallback({
            pcloud: {
                hostname: "api.pcloud.com",
                tokenJson: "{\"access_token\":\"x\",\"token_type\":\"bearer\"}",
            },
            webdav: {
                url: "https://webdav.pcloud.com",
                username: "user",
                password: "pass",
            },
        }),
        "pcloud active with complete webdav enables playback fallback",
    );

    assert(
        !shouldUseWebdavPlaybackFallback({
            webdav: {
                url: "https://webdav.pcloud.com",
                username: "user",
                password: "pass",
            },
        }),
        "webdav-only transport does not need playback fallback",
    );

    assert(
        !shouldUseWebdavPlaybackFallback({
            pcloud: {
                hostname: "api.pcloud.com",
                tokenJson: "{\"access_token\":\"x\",\"token_type\":\"bearer\"}",
            },
        }),
        "pcloud without webdav does not enable playback fallback",
    );
}

async function runPlaybackFallbackSimulation(): Promise<void> {
    const primary = createMockClient({
        async getDownloadUrl() {
            throw new Error("PCLOUD_NOT_FOUND");
        },
    });
    const fallback = createMockClient({
        async getDownloadUrl(path) {
            return `https://webdav.example${path}`;
        },
    });

    let primaryError: unknown;
    let url = "";
    try {
        url = await primary.getDownloadUrl("/MusicFree/song.flac");
    } catch (error) {
        primaryError = error;
        url = await fallback.getDownloadUrl("/MusicFree/song.flac");
    }

    assert(primaryError instanceof Error, "primary failure is captured");
    assert(
        url === "https://webdav.example/MusicFree/song.flac",
        "fallback webdav download url is used after primary failure",
    );

    const primaryExists = createMockClient({
        async exists() {
            return false;
        },
    });
    const fallbackExists = createMockClient({
        async exists() {
            return true;
        },
    });

    let exists = await primaryExists.exists("/MusicFree/song.flac");
    if (!exists) {
        exists = await fallbackExists.exists("/MusicFree/song.flac");
    }
    assert(exists, "exists falls back when primary reports missing file");
}

async function runTests(): Promise<void> {
    await runFallbackHelperTests();
    await runPlaybackFallbackSimulation();
}

runTests().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message);
});
