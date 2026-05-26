import { remotePathsForWebdavTrack } from "../webdav-download-path";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function runTests(): void {
    const paths = remotePathsForWebdavTrack(
        "/(Reinstall)/BACKUP/MusicFree/Download/最后一页@江语晨.flac",
    );
    assert(
        paths.audioPath ===
            "/(Reinstall)/BACKUP/MusicFree/Download/最后一页@江语晨.flac",
        "audio path",
    );
    assert(
        paths.lrcPath ===
            "/(Reinstall)/BACKUP/MusicFree/Download/最后一页@江语晨.lrc",
        "lrc path",
    );
    assert(
        paths.tranLrcPath ===
            "/(Reinstall)/BACKUP/MusicFree/Download/最后一页@江语晨.tran.lrc",
        "tran lrc path",
    );
}

runTests();
