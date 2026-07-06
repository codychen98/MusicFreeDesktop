import {
    probeVerifiedRemoteTransport,
    type VerifiedRemoteTransportStatus,
} from "./probe-remote-transport";
import type { RemoteStorageCredentials, RemoteTransport } from "./types";

export type VerifiedRemoteTransportViewStatus =
    | VerifiedRemoteTransportStatus
    | "checking";

type VerifiedRemoteTransportListener = (
    status: VerifiedRemoteTransportViewStatus,
) => void;

let cachedProbeKey = "";
let status: VerifiedRemoteTransportViewStatus = "checking";
let probeGeneration = 0;
let inFlightProbe: Promise<VerifiedRemoteTransportStatus> | null = null;
const listeners = new Set<VerifiedRemoteTransportListener>();

function notifyListeners(): void {
    for (const listener of listeners) {
        listener(status);
    }
}

export function buildRemoteCredentialsProbeKey(
    credentials: RemoteStorageCredentials,
): string {
    const pcloud = credentials.pcloud;
    const webdav = credentials.webdav;
    return [
        pcloud?.hostname?.trim() ?? "",
        pcloud?.tokenJson?.trim() ?? "",
        webdav?.url?.trim() ?? "",
        webdav?.rootPath?.trim() ?? "",
        webdav?.username?.trim() ?? "",
        webdav?.password ?? "",
    ].join("\0");
}

export function getVerifiedRemoteTransportStatus(): VerifiedRemoteTransportViewStatus {
    return status;
}

export function subscribeVerifiedRemoteTransport(
    listener: VerifiedRemoteTransportListener,
): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function verifiedStatusToTransport(
    value: VerifiedRemoteTransportViewStatus,
): RemoteTransport | null {
    if (value === "pcloud" || value === "webdav") {
        return value;
    }
    return null;
}

export function isVerifiedRemoteTransportOnline(
    value: VerifiedRemoteTransportViewStatus = status,
): boolean {
    return value === "pcloud" || value === "webdav";
}

export async function runVerifiedRemoteTransportProbe(
    credentials: RemoteStorageCredentials,
    options: { force?: boolean } = {},
): Promise<VerifiedRemoteTransportStatus> {
    const probeKey = buildRemoteCredentialsProbeKey(credentials);
    if (
        !options.force
        && probeKey === cachedProbeKey
        && status !== "checking"
    ) {
        return status as VerifiedRemoteTransportStatus;
    }

    cachedProbeKey = probeKey;
    const generation = ++probeGeneration;
    status = "checking";
    notifyListeners();

    const probePromise = probeVerifiedRemoteTransport(credentials);
    inFlightProbe = probePromise;

    try {
        const result = await probePromise;
        if (generation === probeGeneration) {
            status = result;
            notifyListeners();
        }
        return result;
    } finally {
        if (inFlightProbe === probePromise) {
            inFlightProbe = null;
        }
    }
}

export async function awaitVerifiedRemoteTransportProbeIdle(): Promise<void> {
    if (inFlightProbe) {
        await inFlightProbe;
    }
}

export async function awaitVerifiedRemoteTransport(
    credentials: RemoteStorageCredentials,
): Promise<RemoteTransport | null> {
    const probeKey = buildRemoteCredentialsProbeKey(credentials);
    if (probeKey !== cachedProbeKey || status === "checking") {
        await runVerifiedRemoteTransportProbe(credentials);
    }
    return verifiedStatusToTransport(status);
}
