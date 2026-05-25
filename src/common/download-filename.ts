/** Mirrors Android `src/utils/downloadFilename.ts`. */
const FILENAME_UNSAFE = /[/|\\?*"<>:@]+/g;

const MAX_BASENAME_LENGTH = 200;

export type DownloadBasenameFormat = "v2" | "legacy";

export interface ParsedDownloadBasename {
    format: DownloadBasenameFormat;
    title: string;
    artist: string;
    platform?: string;
    id?: string;
}

export function escapeFilenameSegment(str?: string): string {
    return str !== undefined ? `${str}`.replace(FILENAME_UNSAFE, "_") : "";
}

export function buildDownloadBasename(musicItem: {
    title?: string;
    artist?: string;
}): string {
    const title = escapeFilenameSegment(musicItem.title);
    const artist = escapeFilenameSegment(musicItem.artist);
    return `${title}@${artist}`.slice(0, MAX_BASENAME_LENGTH);
}

export function parseDownloadBasename(
    filenameWithoutExt: string,
): ParsedDownloadBasename | null {
    const segments = filenameWithoutExt.split("@");

    if (segments.length >= 4) {
        const [platform, id, title, ...artistParts] = segments;
        if (!platform || !id) {
            return null;
        }
        return {
            format: "legacy",
            platform,
            id,
            title: title ?? "",
            artist: artistParts.join("@"),
        };
    }

    if (segments.length === 2) {
        const [title, artist] = segments;
        return {
            format: "v2",
            title: title ?? "",
            artist: artist ?? "",
        };
    }

    return null;
}
