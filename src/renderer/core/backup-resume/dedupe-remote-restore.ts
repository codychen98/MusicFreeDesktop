import { localPluginName } from "@/common/constant";
import { WEBDAV_MUSIC_PLUGIN_PLATFORM } from "@/renderer/core/webdav-download/config";

function remoteRestoreItemRank(item: IMusic.IMusicItem): number {
    if (item.platform === WEBDAV_MUSIC_PLUGIN_PLATFORM) {
        return 3;
    }
    if (item.platform === localPluginName) {
        return 1;
    }
    return 2;
}

/**
 * When applying remote backup:
 * 1) Drop exact duplicate rows (same platform + id).
 * 2) For same title+artist with different identities (e.g. bimiao + WebDAV), keep one — WebDAV wins.
 */
export function dedupeMusicListForRemoteRestore(
    items: IMusic.IMusicItem[],
): IMusic.IMusicItem[] {
    const byMedia = new Map<string, IMusic.IMusicItem>();
    for (const item of items) {
        if (!item?.platform || item.id == null) {
            continue;
        }
        const mediaKey = `${item.platform}\u0000${item.id}`;
        byMedia.set(mediaKey, item);
    }

    const byTitleArtist = new Map<string, IMusic.IMusicItem[]>();
    for (const item of byMedia.values()) {
        const taKey = `${item.title}\u0000${item.artist}`;
        const group = byTitleArtist.get(taKey);
        if (group) {
            group.push(item);
        } else {
            byTitleArtist.set(taKey, [item]);
        }
    }

    const result: IMusic.IMusicItem[] = [];
    for (const group of byTitleArtist.values()) {
        if (group.length === 1) {
            result.push(group[0]!);
            continue;
        }
        let best = group[0]!;
        for (let i = 1; i < group.length; i++) {
            const candidate = group[i]!;
            if (remoteRestoreItemRank(candidate) > remoteRestoreItemRank(best)) {
                best = candidate;
            }
        }
        result.push(best);
    }
    return result;
}
