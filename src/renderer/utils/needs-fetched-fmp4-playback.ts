import { WEBDAV_MUSIC_PLUGIN_PLATFORM } from "@/renderer/core/webdav-download/config";
import getUrlExt from "@/renderer/utils/get-url-ext";

/** Extensions played via fetch + blob (fMP4 / DASH-style segments Chromium rejects as direct src). */
const FETCHED_FMP4_EXTENSIONS = new Set([".m4s"]);

function hasFetchedFmp4Extension(pathOrUrl?: string): boolean {
    if (!pathOrUrl) {
        return false;
    }
    try {
        const ext = getUrlExt(
            pathOrUrl.includes("://") ? pathOrUrl : `file://local${pathOrUrl}`,
        );
        return ext ? FETCHED_FMP4_EXTENSIONS.has(ext) : false;
    } catch {
        const lower = pathOrUrl.toLowerCase();
        return FETCHED_FMP4_EXTENSIONS.has(
            lower.slice(lower.lastIndexOf(".")),
        );
    }
}

export default function needsFetchedFmp4Playback(
    url?: string,
    musicItem?: IMusic.IMusicItem | null,
): boolean {
    if (hasFetchedFmp4Extension(url)) {
        return true;
    }
    if (
        musicItem?.platform === WEBDAV_MUSIC_PLUGIN_PLATFORM &&
        hasFetchedFmp4Extension(musicItem.id)
    ) {
        return true;
    }
    return false;
}
