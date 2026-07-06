import {
    isValidPcloudTokenJson,
    parsePcloudTokenJson,
} from "../../shared/remote-storage/parse-pcloud-token";
import { createPcloudRemoteStorage } from "../../shared/remote-storage/pcloud-adapter";
import type { PcloudFetch } from "../../shared/remote-storage/pcloud-adapter";
import { createRemoteStorageClient } from "../../shared/remote-storage/resolve";
import {
    PcloudApiError,
    PcloudTokenInvalidError,
    PcloudTokenParseError,
} from "../../shared/remote-storage/types";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function assertThrows(
    fn: () => void,
    expectedName: string,
    message: string,
): void {
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

interface MockRequest {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: unknown;
}

function headersToRecord(headers?: HeadersInit): Record<string, string> {
    if (!headers) {
        return {};
    }
    if (headers instanceof Headers) {
        const record: Record<string, string> = {};
        headers.forEach((value, key) => {
            record[key.toLowerCase()] = value;
        });
        return record;
    }
    if (Array.isArray(headers)) {
        return Object.fromEntries(
            headers.map(([key, value]) => [key.toLowerCase(), value]),
        );
    }
    return Object.fromEntries(
        Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
    );
}

function createMockFetch(
    handlers: Record<
        string,
        (request: MockRequest) => Response | Promise<Response>
    >,
): { fetch: PcloudFetch; requests: MockRequest[] } {
    const requests: MockRequest[] = [];
    const fetchImpl: PcloudFetch = async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        const request: MockRequest = {
            url,
            method,
            headers: headersToRecord(init?.headers),
            body: init?.body,
        };
        requests.push(request);

        const pathname = new URL(url).pathname.replace(/^\//, "");
        const handler = handlers[pathname];
        if (!handler) {
            throw new Error(`No mock handler for ${pathname}`);
        }
        return handler(request);
    };
    return { fetch: fetchImpl, requests };
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    });
}

function runTokenParseTests(): void {
    const parsed = parsePcloudTokenJson(
        "{\"access_token\":\"abc123\",\"token_type\":\"bearer\",\"expiry\":\"0001-01-01T00:00:00Z\"}",
    );
    assert(parsed.accessToken === "abc123", "parses valid rclone token");

    assertThrows(
        () => parsePcloudTokenJson("{not-json"),
        "PcloudTokenParseError",
        "invalid JSON throws PcloudTokenParseError",
    );

    assertThrows(
        () => parsePcloudTokenJson("{\"token_type\":\"bearer\"}"),
        "PcloudTokenInvalidError",
        "missing access_token throws PcloudTokenInvalidError",
    );

    assertThrows(
        () =>
            parsePcloudTokenJson(
                "{\"access_token\":\"abc\",\"token_type\":\"mac\"}",
            ),
        "PcloudTokenInvalidError",
        "invalid token_type throws PcloudTokenInvalidError",
    );

    assert(
        isValidPcloudTokenJson(
            "{\"access_token\":\"abc\",\"token_type\":\"bearer\"}",
        ),
        "isValidPcloudTokenJson true for valid token",
    );
    assert(
        !isValidPcloudTokenJson("not-json"),
        "isValidPcloudTokenJson false for invalid JSON",
    );
}

async function runAdapterTests(): Promise<void> {
    const { fetch, requests } = createMockFetch({
        stat: (request) => {
            assert(
                request.url.includes("api.pcloud.com/stat"),
                "US hostname used in stat request",
            );
            if (request.url.includes("path=%2Fmissing.txt")) {
                return jsonResponse({
                    result: 2055,
                    error: "File or folder not found.",
                });
            }
            return jsonResponse({
                result: 0,
                metadata: {
                    path: "/MusicFree/MusicFreeBackup.json",
                    name: "MusicFreeBackup.json",
                    isfolder: false,
                    size: 12,
                },
            });
        },
        createfolderifnotexists: () =>
            jsonResponse({
                result: 0,
                metadata: { path: "/MusicFree", isfolder: true },
            }),
        uploadfile: (request) => {
            assert(request.method === "PUT", "upload uses PUT");
            assert(
                request.headers["content-length"] === "11",
                "upload sets Content-Length",
            );
            return jsonResponse({ result: 0, metadata: [] });
        },
        gettextfile: () =>
            new Response("{\"ok\":true}", {
                headers: { "content-type": "text/plain" },
            }),
        getfilelink: () =>
            jsonResponse({
                result: 0,
                hosts: ["dl1.pcloud.com"],
                path: "/DL/song.flac",
            }),
        listfolder: () =>
            jsonResponse({
                result: 0,
                metadata: {
                    path: "/Music",
                    contents: [
                        {
                            path: "/Music/song.flac",
                            name: "song.flac",
                            isfolder: false,
                            size: 100,
                            contenttype: "audio/flac",
                        },
                    ],
                },
            }),
        deletefile: () => jsonResponse({ result: 0 }),
        renamefile: () => jsonResponse({ result: 0 }),
    });

    const client = createPcloudRemoteStorage({
        hostname: "api.pcloud.com",
        accessToken: "token-us",
        fetch,
    });

    assert(
        !(await client.exists("/missing.txt")),
        "exists returns false for 2055 stat",
    );
    assert(
        await client.exists("/MusicFree/MusicFreeBackup.json"),
        "exists returns true for present file",
    );

    await client.ensureDir("/MusicFree");
    await client.putText("/MusicFree/MusicFreeBackup.json", "{\"ok\":true}");
    const text = await client.getText("/MusicFree/MusicFreeBackup.json");
    assert(text === "{\"ok\":true}", "getText returns body");

    const downloadUrl = await client.getDownloadUrl("/Music/song.flac");
    assert(
        downloadUrl === "https://dl1.pcloud.com/DL/song.flac",
        "getDownloadUrl returns usable HTTPS URL shape",
    );

    const entries = await client.listDirectory("/Music");
    assert(entries.length === 1 && entries[0]?.basename === "song.flac", "listDirectory maps files");

    await client.deleteFile("/Music/song.flac");
    await client.moveFile("/Music/a.flac", "/Music/b.flac");

    assert(
        requests.every(
            (request) =>
                request.headers.authorization === "Bearer token-us",
        ),
        "requests include bearer authorization",
    );
}

async function runRecursiveEnsureDirTest(): Promise<void> {
    const createdPaths: string[] = [];
    const { fetch } = createMockFetch({
        createfolderifnotexists: (request) => {
            const path = new URL(request.url).searchParams.get("path") ?? "";
            createdPaths.push(path);
            return jsonResponse({
                result: 0,
                metadata: { path, isfolder: true },
            });
        },
    });

    const client = createPcloudRemoteStorage({
        hostname: "api.pcloud.com",
        accessToken: "token-us",
        fetch,
    });
    await client.ensureDir("/(Reinstall)/BACKUP/MusicFree/Download");
    assert(
        createdPaths.join("|") ===
            "/(Reinstall)|/(Reinstall)/BACKUP|/(Reinstall)/BACKUP/MusicFree|/(Reinstall)/BACKUP/MusicFree/Download",
        "ensureDir creates each path segment",
    );
}

async function runEuHostnameTest(): Promise<void> {
    const { fetch, requests } = createMockFetch({
        stat: () =>
            jsonResponse({
                result: 0,
                metadata: { path: "/file.txt", isfolder: false },
            }),
    });

    const client = createPcloudRemoteStorage({
        hostname: "eapi.pcloud.com",
        accessToken: "token-eu",
        fetch,
    });
    await client.exists("/file.txt");
    assert(
        requests[0]?.url.startsWith("https://eapi.pcloud.com/stat"),
        "EU hostname passed to request URL",
    );
}

async function runInvalidTokenErrorTest(): Promise<void> {
    const { fetch } = createMockFetch({
        listfolder: () =>
            jsonResponse({
                result: 2094,
                error: "Invalid 'access_token' provided.",
            }),
    });

    const client = createPcloudRemoteStorage({
        hostname: "api.pcloud.com",
        accessToken: "bad-token",
        fetch,
    });

    let caught: unknown;
    try {
        await client.listDirectory("/");
    } catch (error) {
        caught = error;
    }
    assert(
        caught instanceof PcloudApiError && caught.code === 2094,
        "invalid token surfaces API error 2094",
    );
}

function runResolverPcloudClientTest(): void {
    const client = createRemoteStorageClient({
        pcloud: {
            hostname: "api.pcloud.com",
            tokenJson:
                "{\"access_token\":\"resolver-token\",\"token_type\":\"bearer\"}",
        },
    });

    assert(
        typeof client.exists === "function" &&
            typeof client.getDownloadUrl === "function",
        "resolver creates pcloud client instead of throwing",
    );
}

async function runRendererSafePutTextTest(): Promise<void> {
    let uploadBody: unknown;
    const fetchImpl: PcloudFetch = async (_input, init) => {
        uploadBody = init?.body;
        return {
            json: async () => ({ result: 0 }),
            ok: true,
            headers: {
                get: () => "application/json",
            },
        } as unknown as Response;
    };
    const client = createPcloudRemoteStorage({
        hostname: "api.pcloud.com",
        accessToken: "token-us",
        fetch: fetchImpl,
    });

    const globalWithBuffer = globalThis as typeof globalThis & {
        Buffer?: typeof Buffer;
    };
    const savedBuffer = globalWithBuffer.Buffer;
    try {
        globalWithBuffer.Buffer = undefined;
        await client.putText("/MusicFree/MusicFreeBackup.json", "{\"ok\":true}");
    } finally {
        globalWithBuffer.Buffer = savedBuffer;
    }

    assert(
        uploadBody instanceof Uint8Array && uploadBody.length > 0,
        "putText uploads via Uint8Array without Node Buffer",
    );
}

async function runTests(): Promise<void> {
    runTokenParseTests();
    await runAdapterTests();
    await runRecursiveEnsureDirTest();
    await runEuHostnameTest();
    await runInvalidTokenErrorTest();
    await runRendererSafePutTextTest();
    runResolverPcloudClientTest();
}

runTests()
    .then(() => {
        // ok
    })
    .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(message);
    });
