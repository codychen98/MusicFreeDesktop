import type { IBackupPayload } from "./types";

export function countTracksInBackupPayload(payload: IBackupPayload): number {
    return payload.musicSheets.reduce(
        (total, sheet) => total + (sheet.musicList?.length ?? 0),
        0,
    );
}

export function countTracksInMusicSheets(
    sheets: Array<{ musicList?: Array<unknown> | null }>,
): number {
    return sheets.reduce(
        (total, sheet) => total + (sheet.musicList?.length ?? 0),
        0,
    );
}
