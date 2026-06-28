import path from "path";

import { buildDownloadBasename } from "./download-filename";
import {
    lyricSidecarFilename,
    translationSidecarFilename,
} from "./webdav-download-path";

export function getAudioBasename(audioFilenameOrPath: string): string {
    return path.basename(audioFilenameOrPath);
}

export function getAudioExtension(audioFilenameOrPath: string): string {
    const basename = getAudioBasename(audioFilenameOrPath);
    const lastDot = basename.lastIndexOf(".");
    if (lastDot === -1 || lastDot === basename.length - 1) {
        return "mp3";
    }
    return basename.slice(lastDot + 1);
}

export function buildRenamedAudioFilename(
    currentAudioFilename: string,
    title: string,
    artist: string,
): string {
    const ext = getAudioExtension(currentAudioFilename);
    return `${buildDownloadBasename({ title, artist })}.${ext}`;
}

export function localSidecarPathsForAudio(audioPath: string): {
    lrcPath: string;
    tranLrcPath: string;
} {
    const audioFilename = getAudioBasename(audioPath);
    const dir = path.dirname(audioPath);
    return {
        lrcPath: path.join(dir, lyricSidecarFilename(audioFilename)),
        tranLrcPath: path.join(dir, translationSidecarFilename(audioFilename)),
    };
}
