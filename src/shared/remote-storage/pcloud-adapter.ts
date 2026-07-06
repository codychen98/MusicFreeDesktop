import { normalizeRemotePath } from "./paths";
import type { RemoteDirectoryEntry, RemoteStorageClient } from "./types";
import { PcloudApiError } from "./types";

export type PcloudFetch = (
    input: string | URL,
    init?: RequestInit,
) => Promise<Response>;

export interface PcloudClientOptions {
    hostname: string;
    accessToken: string;
    fetch?: PcloudFetch;
}

interface PcloudMetadata {
    path?: string;
    name?: string;
    size?: number;
    isfolder?: boolean;
    contenttype?: string;
    contents?: PcloudMetadata[];
}

interface PcloudJsonResponse {
    result: number;
    error?: string;
    metadata?: PcloudMetadata;
    hosts?: string[];
    path?: string;
}

function normalizeHostname(hostname: string): string {
    return hostname.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function splitRemotePath(path: string): { folderPath: string; filename: string } {
    const normalized = normalizeRemotePath(path);
    const lastSlash = normalized.lastIndexOf("/");
    if (lastSlash <= 0) {
        return {
            folderPath: "/",
            filename: normalized.slice(1),
        };
    }
    return {
        folderPath: normalized.slice(0, lastSlash) || "/",
        filename: normalized.slice(lastSlash + 1),
    };
}

function basenameFromPath(path: string): string {
    const normalized = normalizeRemotePath(path);
    const lastSlash = normalized.lastIndexOf("/");
    return lastSlash === -1 ? normalized : normalized.slice(lastSlash + 1);
}

function toDirectoryEntry(metadata: PcloudMetadata): RemoteDirectoryEntry | null {
    const path = metadata.path ? normalizeRemotePath(metadata.path) : "";
    const name = metadata.name ?? basenameFromPath(path);
    if (!path || !name) {
        return null;
    }
    if (metadata.isfolder) {
        return {
            path,
            basename: name,
            size: metadata.size ?? 0,
            type: "directory",
        };
    }
    return {
        path,
        basename: name,
        size: metadata.size ?? 0,
        type: "file",
        mime: metadata.contenttype,
    };
}

function assertPcloudSuccess(data: PcloudJsonResponse): void {
    if (data.result === 0) {
        return;
    }
    throw new PcloudApiError(data.result, data.error ?? "unknown error");
}

function isNotFoundError(error: unknown): boolean {
    return error instanceof PcloudApiError && error.code === 2009;
}

export function createPcloudRemoteStorage(
    options: PcloudClientOptions,
): RemoteStorageClient {
    const hostname = normalizeHostname(options.hostname);
    const accessToken = options.accessToken.trim();
    const fetchFn: PcloudFetch = options.fetch ?? fetch;
    const pathFor = (path: string) => normalizeRemotePath(path);

    const buildUrl = (method: string, params: Record<string, string>): URL => {
        const url = new URL(`https://${hostname}/${method}`);
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, value);
        }
        return url;
    };

    const authHeaders = (): HeadersInit => ({
        Authorization: `Bearer ${accessToken}`,
    });

    const callJson = async (
        method: string,
        params: Record<string, string>,
        init?: RequestInit,
    ): Promise<PcloudJsonResponse> => {
        const url = buildUrl(method, params);
        const response = await fetchFn(url.toString(), {
            ...init,
            headers: {
                ...authHeaders(),
                ...(init?.headers ?? {}),
            },
        });
        const data = (await response.json()) as PcloudJsonResponse;
        assertPcloudSuccess(data);
        return data;
    };

    const stat = async (path: string): Promise<PcloudMetadata | null> => {
        try {
            const data = await callJson("stat", { path: pathFor(path) });
            return data.metadata ?? null;
        } catch (error) {
            if (isNotFoundError(error)) {
                return null;
            }
            throw error;
        }
    };

    const uploadBinary = async (path: string, body: Buffer): Promise<void> => {
        const normalized = pathFor(path);
        const { folderPath, filename } = splitRemotePath(normalized);
        const params = {
            path: folderPath,
            filename,
            nopartial: "1",
        };

        if (body.length === 0) {
            const form = new FormData();
            form.append("path", folderPath);
            form.append("filename", filename);
            form.append("nopartial", "1");
            form.append("content", new Blob([]), filename);
            const response = await fetchFn(`https://${hostname}/uploadfile`, {
                method: "POST",
                headers: authHeaders(),
                body: form,
            });
            const data = (await response.json()) as PcloudJsonResponse;
            assertPcloudSuccess(data);
            return;
        }

        const url = buildUrl("uploadfile", params);
        const response = await fetchFn(url.toString(), {
            method: "PUT",
            headers: {
                ...authHeaders(),
                "Content-Length": String(body.length),
                "Content-Type": "application/octet-stream",
                "Transfer-Encoding": "identity",
            },
            body,
        });
        const data = (await response.json()) as PcloudJsonResponse;
        assertPcloudSuccess(data);
    };

    return {
        async exists(path) {
            const metadata = await stat(path);
            return metadata !== null;
        },

        async getText(path) {
            const url = buildUrl("gettextfile", { path: pathFor(path) });
            const response = await fetchFn(url.toString(), {
                headers: authHeaders(),
            });
            const contentType = response.headers.get("content-type") ?? "";
            if (contentType.includes("application/json")) {
                const data = (await response.json()) as PcloudJsonResponse;
                assertPcloudSuccess(data);
            }
            if (!response.ok) {
                throw new PcloudApiError(response.status, "gettextfile failed");
            }
            return response.text();
        },

        async getBinary(path) {
            const downloadUrl = await this.getDownloadUrl(path);
            const response = await fetchFn(downloadUrl);
            if (!response.ok) {
                throw new PcloudApiError(response.status, "download failed");
            }
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        },

        async putText(path, body) {
            await uploadBinary(pathFor(path), Buffer.from(body, "utf8"));
        },

        async putBinary(path, body) {
            await uploadBinary(pathFor(path), body);
        },

        async ensureDir(path) {
            await callJson("createfolderifnotexists", { path: pathFor(path) });
        },

        async deleteFile(path) {
            await callJson("deletefile", { path: pathFor(path) });
        },

        async moveFile(from, to) {
            await callJson("renamefile", {
                path: pathFor(from),
                topath: pathFor(to),
            });
        },

        async listDirectory(path) {
            const data = await callJson("listfolder", { path: pathFor(path) });
            const contents = data.metadata?.contents ?? [];
            return contents
                .map((item) => toDirectoryEntry(item))
                .filter((item): item is RemoteDirectoryEntry => item !== null);
        },

        async getDownloadUrl(path) {
            const data = await callJson("getfilelink", { path: pathFor(path) });
            const host = data.hosts?.[0];
            const downloadPath = data.path;
            if (!host || !downloadPath) {
                throw new PcloudApiError(0, "invalid getfilelink response");
            }
            return `https://${host}${downloadPath}`;
        },
    };
}
