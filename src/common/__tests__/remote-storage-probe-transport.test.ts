import { probeVerifiedRemoteTransport } from "../../shared/remote-storage/probe-remote-transport";
import {
    buildRemoteCredentialsProbeKey,
    isVerifiedRemoteTransportOnline,
    runVerifiedRemoteTransportProbe,
    verifiedStatusToTransport,
} from "../../shared/remote-storage/verified-remote-transport-store";
import type { RemoteStorageCredentials } from "../../shared/remote-storage/types";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

type FetchHandler = (input: string) => Response | Promise<Response>;

function createMockFetch(handler: FetchHandler) {
    return async (input: string | URL) => handler(String(input));
}

function createCredentials(
    overrides: Partial<RemoteStorageCredentials> = {},
): RemoteStorageCredentials {
    return {
        pcloud: overrides.pcloud,
        webdav: overrides.webdav,
    };
}

async function runProbePriorityTests(): Promise<void> {
    const webdav = {
        url: "https://webdav.example",
        username: "user",
        password: "pass",
    };

    const pcloudOk = await probeVerifiedRemoteTransport(
        createCredentials({
            pcloud: {
                hostname: "api.pcloud.com",
                tokenJson:
                    "{\"access_token\":\"good\",\"token_type\":\"bearer\"}",
            },
            webdav,
        }),
        {
            fetch: createMockFetch((input) => {
                if (input.includes("/userinfo")) {
                    return new Response(JSON.stringify({ result: 0 }));
                }
                throw new Error(`unexpected fetch ${input}`);
            }),
        },
    );
    assert(pcloudOk === "pcloud", "valid pcloud probe selects pcloud");

    const webdavFallback = await probeVerifiedRemoteTransport(
        createCredentials({
            pcloud: {
                hostname: "api.pcloud.com",
                tokenJson:
                    "{\"access_token\":\"bad\",\"token_type\":\"bearer\"}",
            },
            webdav,
        }),
        {
            fetch: createMockFetch((input) => {
                if (input.includes("/userinfo")) {
                    return new Response(
                        JSON.stringify({
                            result: 2094,
                            error: "Invalid 'access_token' provided.",
                        }),
                    );
                }
                throw new Error(`unexpected fetch ${input}`);
            }),
            probeWebdav: async () => true,
        },
    );
    assert(
        webdavFallback === "webdav",
        "failed pcloud with working webdav selects webdav",
    );

    const bothOffline = await probeVerifiedRemoteTransport(
        createCredentials({
            pcloud: {
                hostname: "api.pcloud.com",
                tokenJson:
                    "{\"access_token\":\"bad\",\"token_type\":\"bearer\"}",
            },
            webdav,
        }),
        {
            fetch: createMockFetch((input) => {
                if (input.includes("/userinfo")) {
                    return new Response(
                        JSON.stringify({
                            result: 2094,
                            error: "Invalid 'access_token' provided.",
                        }),
                    );
                }
                throw new Error(`unexpected fetch ${input}`);
            }),
            probeWebdav: async () => false,
        },
    );
    assert(
        bothOffline === "both_offline",
        "failed pcloud and webdav reports both_offline",
    );

    const webdavOnly = await probeVerifiedRemoteTransport(
        createCredentials({ webdav }),
        {
            probeWebdav: async () => true,
        },
    );
    assert(webdavOnly === "webdav", "webdav-only success selects webdav");

    const none = await probeVerifiedRemoteTransport(createCredentials({}));
    assert(none === "none", "missing credentials reports none");
}

async function runStoreHelperTests(): Promise<void> {
    const webdav = {
        url: "https://webdav.example",
        username: "user",
        password: "pass",
    };
    const credentials = createCredentials({ webdav });
    const key = buildRemoteCredentialsProbeKey(credentials);
    assert(key.includes("https://webdav.example"), "probe key includes webdav url");
    assert(verifiedStatusToTransport("pcloud") === "pcloud", "maps pcloud status");
    assert(verifiedStatusToTransport("both_offline") === null, "offline maps to null");
    assert(isVerifiedRemoteTransportOnline("webdav"), "webdav status is online");

    await runVerifiedRemoteTransportProbe(
        createCredentials({
            pcloud: {
                hostname: "api.pcloud.com",
                tokenJson:
                    "{\"access_token\":\"good\",\"token_type\":\"bearer\"}",
            },
            webdav,
        }),
        { force: true },
    );
}

async function runTests(): Promise<void> {
    await runProbePriorityTests();
    await runStoreHelperTests();
}

runTests().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message);
});
