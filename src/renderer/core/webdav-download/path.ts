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
