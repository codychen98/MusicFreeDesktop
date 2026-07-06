import type { FileStat, WebDAVClient } from "webdav";

import { normalizeRemotePath } from "./paths";
import type { RemoteDirectoryEntry, RemoteStorageClient } from "./types";

function isFileStatArray(
    value: Awaited<ReturnType<WebDAVClient["getDirectoryContents"]>>,
): value is FileStat[] {
    return Array.isArray(value);
}

function toDirectoryEntries(items: FileStat[]): RemoteDirectoryEntry[] {
    return items.map((item) => ({
        path: normalizeRemotePath(item.filename),
        basename: item.basename,
        size: item.size,
        type: item.type,
        mime: item.mime,
    }));
}

export function createWebdavRemoteStorage(
    client: WebDAVClient,
    pathFor: (path: string) => string = normalizeRemotePath,
): RemoteStorageClient {
    return {
        async exists(path) {
            return client.exists(pathFor(path));
        },

        async getText(path) {
            const contents = await client.getFileContents(pathFor(path), {
                format: "text",
            });
            return String(contents);
        },

        async getBinary(path) {
            const contents = await client.getFileContents(pathFor(path));
            if (Buffer.isBuffer(contents)) {
                return contents;
            }
            if (typeof contents === "string") {
                return Buffer.from(contents);
            }
            return Buffer.from(contents as ArrayBuffer);
        },

        async putText(path, body) {
            await client.putFileContents(pathFor(path), body, { overwrite: true });
        },

        async putBinary(path, body) {
            await client.putFileContents(pathFor(path), body, { overwrite: true });
        },

        async ensureDir(path) {
            const normalized = pathFor(path);
            if (!(await client.exists(normalized))) {
                await client.createDirectory(normalized, { recursive: true });
            }
        },

        async deleteFile(path) {
            await client.deleteFile(pathFor(path));
        },

        async moveFile(from, to) {
            await client.moveFile(pathFor(from), pathFor(to), { overwrite: false });
        },

        async listDirectory(path) {
            const contents = await client.getDirectoryContents(pathFor(path));
            if (!isFileStatArray(contents)) {
                return [];
            }
            return toDirectoryEntries(contents);
        },

        async getDownloadUrl(path) {
            return client.getFileDownloadLink(pathFor(path));
        },
    };
}
