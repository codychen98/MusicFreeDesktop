import fs from "fs/promises";
import url from "url";
import type { BigIntStats, PathLike, StatOptions, Stats } from "original-fs";

export function addFileScheme(filePath: string) {
    return filePath.startsWith("file:")
        ? filePath
        : url.pathToFileURL(filePath).toString();
}

export function addTailSlash(filePath: string) {
    return filePath.endsWith("/") || filePath.endsWith("\\")
        ? filePath
        : filePath + "/";
}

export async function safeStat(
    path: PathLike,
    opts?: StatOptions,
): Promise<Stats | BigIntStats | null> {
    try {
        return await fs.stat(path, opts);
    } catch {
        return null;
    }
}
