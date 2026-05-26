import { toast } from "react-toastify";
import { i18n } from "@/shared/i18n/renderer";

import {
    isWebdavDownloadTargetAvailable,
    WEBDAV_MUSIC_PLUGIN_PLATFORM,
} from "./config";
import { deleteWebdavRemoteTrack } from "./delete";

export type FindSheetsContainingMusic = (
    musicItem: IMusic.IMusicItem,
) => Array<{ id: string; title: string }>;

function playlistTitleSeparator(): string {
    return i18n.language.startsWith("en") ? ", " : "、";
}

/**
 * After playlist rows are removed locally, delete WebDAV remote files when the
 * track is no longer referenced in any playlist. Toast remaining playlist names
 * when remote delete is skipped.
 */
export async function handleWebdavAfterPlaylistRemove(
    removedItems: IMusic.IMusicItem[],
    findSheetsContainingMusic: FindSheetsContainingMusic,
): Promise<void> {
    if (!removedItems.length) {
        return;
    }

    const webdavItems = removedItems.filter(
        item => item.platform === WEBDAV_MUSIC_PLUGIN_PLATFORM,
    );
    if (!webdavItems.length) {
        return;
    }

    const canDeleteRemote = isWebdavDownloadTargetAvailable();

    for (const item of webdavItems) {
        const remainingSheets = findSheetsContainingMusic(item);
        if (remainingSheets.length > 0) {
            toast.warning(
                i18n.t("settings.download.toast_webdav_remote_delete_skipped", {
                    title: item.title,
                    playlists: remainingSheets
                        .map(sheet => sheet.title)
                        .join(playlistTitleSeparator()),
                }),
            );
            continue;
        }

        if (!canDeleteRemote) {
            continue;
        }

        try {
            await deleteWebdavRemoteTrack(item);
        } catch (e: unknown) {
            const reason = e instanceof Error ? e.message : String(e);
            toast.warning(
                i18n.t("settings.download.toast_webdav_remote_delete_failed", {
                    title: item.title,
                    reason,
                }),
            );
        }
    }
}
