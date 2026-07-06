import { resolveRemoteTransport, createRemoteStorageClient } from "../../shared/remote-storage/resolve";
import { createWebdavRemoteStorage } from "../../shared/remote-storage/webdav-adapter";
import type { WebDAVClient } from "webdav";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function assertThrows(fn: () => void, expectedName: string, message: string): void {
    try {
        fn();
        throw new Error(`${message}: expected throw`);
    } catch (error) {
        if (!(error instanceof Error) || error.name !== expectedName) {
            throw new Error(
                `${message}: expected ${expectedName}, got ${String(error)}`,
            );
        }
    }
}

function createMockWebdavClient(): WebDAVClient & {
    calls: Array<{ method: string; args: unknown[] }>;
    store: Map<string, string | Buffer>;
} {
    const store = new Map<string, string | Buffer>();
    const calls: Array<{ method: string; args: unknown[] }> = [];

    const record = (method: string, args: unknown[]) => {
        calls.push({ method, args });
    };

    return {
        calls,
        store,
        async exists(path: string) {
            record("exists", [path]);
            return store.has(path);
        },
        async getFileContents(path: string, options?: { format?: string }) {
            record("getFileContents", [path, options]);
            const value = store.get(path);
            if (value === undefined) {
                throw new Error(`ENOENT: ${path}`);
            }
            if (options?.format === "text") {
                return typeof value === "string" ? value : value.toString("utf8");
            }
            return Buffer.isBuffer(value) ? value : Buffer.from(value);
        },
        async putFileContents(path: string, data: string | Buffer) {
            record("putFileContents", [path, data]);
            store.set(path, data);
            return true;
        },
        async createDirectory(path: string, options?: { recursive?: boolean }) {
            record("createDirectory", [path, options]);
        },
        async deleteFile(path: string) {
            record("deleteFile", [path]);
            store.delete(path);
        },
        async moveFile(from: string, to: string) {
            record("moveFile", [from, to]);
            const value = store.get(from);
            if (value === undefined) {
                throw new Error(`ENOENT: ${from}`);
            }
            store.set(to, value);
            store.delete(from);
        },
        async getDirectoryContents(path: string) {
            record("getDirectoryContents", [path]);
            const prefix = path === "/" ? "/" : `${path}/`;
            const entries = [...store.entries()]
                .filter(([key]) => {
                    if (!key.startsWith(prefix)) {
                        return false;
                    }
                    const remainder = key.slice(prefix.length);
                    return remainder.length > 0 && !remainder.includes("/");
                })
                .map(([key, value]) => {
                    const basename = key.slice(prefix.length);
                    return {
                        filename: key,
                        basename,
                        size: Buffer.isBuffer(value)
                            ? value.length
                            : Buffer.byteLength(value),
                        type: "file" as const,
                    };
                });
            return entries;
        },
        getFileDownloadLink(path: string) {
            record("getFileDownloadLink", [path]);
            return `https://webdav.example${path}`;
        },
    } as unknown as WebDAVClient & {
        calls: Array<{ method: string; args: unknown[] }>;
        store: Map<string, string | Buffer>;
    };
}

async function runAdapterTests(): Promise<void> {
    const mock = createMockWebdavClient();
    const client = createWebdavRemoteStorage(mock);

    await client.ensureDir("/MusicFree");
    assert(
        mock.calls.some(
            (call) =>
                call.method === "createDirectory" && call.args[0] === "/MusicFree",
        ),
        "ensureDir creates missing directory",
    );

    await client.putText("/MusicFree/MusicFreeBackup.json", "{\"ok\":true}");
    assert(
        await client.exists("/MusicFree/MusicFreeBackup.json"),
        "exists after putText",
    );

    const text = await client.getText("/MusicFree/MusicFreeBackup.json");
    assert(text === "{\"ok\":true}", "getText returns uploaded body");

    await client.putBinary("/music/song.flac", Buffer.from([1, 2, 3]));
    const binary = await client.getBinary("/music/song.flac");
    assert(
        binary.length === 3 && binary[0] === 1 && binary[1] === 2,
        "getBinary returns uploaded bytes",
    );

    await client.moveFile("/music/song.flac", "/music/renamed.flac");
    assert(
        !(await client.exists("/music/song.flac")) &&
            (await client.exists("/music/renamed.flac")),
        "moveFile relocates file",
    );

    await client.deleteFile("/music/renamed.flac");
    assert(!(await client.exists("/music/renamed.flac")), "deleteFile removes file");

    const downloadUrl = await client.getDownloadUrl("/MusicFree/MusicFreeBackup.json");
    assert(
        downloadUrl === "https://webdav.example/MusicFree/MusicFreeBackup.json",
        "getDownloadUrl uses webdav client link",
    );
}

function runResolverTests(): void {
    assert(
        resolveRemoteTransport({
            webdav: {
                url: "https://dav.example",
                username: "user",
                password: "pass",
            },
        }) === "webdav",
        "complete webdav credentials resolve to webdav",
    );

    assert(
        resolveRemoteTransport({
            webdav: { url: "https://dav.example", username: "user" },
        }) === null,
        "incomplete webdav credentials resolve to null",
    );

    assert(
        resolveRemoteTransport({
            pcloud: {
                hostname: "api.pcloud.com",
                tokenJson: "{\"access_token\":\"x\",\"token_type\":\"bearer\"}",
            },
            webdav: {
                url: "https://dav.example",
                username: "user",
                password: "pass",
            },
        }) === "pcloud",
        "pcloud wins over webdav when both complete",
    );

    assert(
        resolveRemoteTransport({
            pcloud: {
                hostname: "api.pcloud.com",
                tokenJson: "not-valid-json",
            },
            webdav: {
                url: "https://dav.example",
                username: "user",
                password: "pass",
            },
        }) === "webdav",
        "invalid pcloud token falls through to webdav when webdav complete",
    );

    assert(
        resolveRemoteTransport({
            pcloud: {
                hostname: "api.pcloud.com",
                tokenJson: "not-valid-json",
            },
        }) === null,
        "invalid pcloud token alone resolves to null",
    );

    assertThrows(
        () =>
            createRemoteStorageClient({
                webdav: { url: "https://dav.example", username: "user" },
            }),
        "RemoteCredentialsIncompleteError",
        "incomplete credentials throw RemoteCredentialsIncompleteError",
    );
}

async function runTests(): Promise<void> {
    await runAdapterTests();
    runResolverTests();
}

runTests()
    .then(() => {
        // ok
    })
    .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(message);
    });
