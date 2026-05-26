export function resolveFirstSearchPathSegment(
    searchPath: string | undefined,
): string {
    if (!searchPath?.trim()) {
        return "";
    }
    const first = searchPath.split(",")[0]?.trim() ?? "";
    if (!first) {
        return "";
    }
    return first.replace(/\\/g, "/").replace(/\/+$/, "") || first;
}

export function resolveRemoteDir(searchPath: string | undefined): string {
    return resolveFirstSearchPathSegment(searchPath);
}

export function remotePathFor(remoteDir: string, filename: string): string {
    const dir = remoteDir.replace(/\\/g, "/").replace(/\/+$/, "");
    const base = filename.replace(/^\/+/, "");
    if (!dir) {
        return `/${base}`;
    }
    if (dir === "/") {
        return `/${base}`;
    }
    return `${dir}/${base}`;
}

export function lyricSidecarFilename(audioFilename: string): string {
    const lastDot = audioFilename.lastIndexOf(".");
    const base =
        lastDot === -1 ? audioFilename : audioFilename.slice(0, lastDot);
    return `${base}.lrc`;
}

export function translationSidecarFilename(audioFilename: string): string {
    const lastDot = audioFilename.lastIndexOf(".");
    const base =
        lastDot === -1 ? audioFilename : audioFilename.slice(0, lastDot);
    return `${base}.tran.lrc`;
}

export function remotePathsForWebdavTrack(remoteAudioPath: string): {
    audioPath: string;
    lrcPath: string;
    tranLrcPath: string;
} {
    const normalized = remoteAudioPath.replace(/\\/g, "/");
    const lastSlash = normalized.lastIndexOf("/");
    const remoteDir =
        lastSlash === -1 ? "" : normalized.slice(0, lastSlash);
    const audioFilename =
        lastSlash === -1 ? normalized : normalized.slice(lastSlash + 1);

    return {
        audioPath: normalized,
        lrcPath: remotePathFor(remoteDir, lyricSidecarFilename(audioFilename)),
        tranLrcPath: remotePathFor(
            remoteDir,
            translationSidecarFilename(audioFilename),
        ),
    };
}
