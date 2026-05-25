import { isDownloaded, removeDownloadedMusic } from "./downloaded-sheet";

export async function removeDownloadedMusicIfPresent(
    musicItem: IMusic.IMusicItem,
): Promise<void> {
    if (isDownloaded(musicItem)) {
        await removeDownloadedMusic(musicItem, false);
    }
}
