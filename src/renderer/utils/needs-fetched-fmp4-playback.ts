import getUrlExt from "@/renderer/utils/get-url-ext";

/** Extensions played via fetch + blob (fMP4 / DASH-style segments Chromium rejects as direct src). */
const FETCHED_FMP4_EXTENSIONS = new Set([".m4s"]);

export default function needsFetchedFmp4Playback(url?: string): boolean {
    const ext = getUrlExt(url);
    return ext ? FETCHED_FMP4_EXTENSIONS.has(ext) : false;
}
