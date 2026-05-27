import { dedupeMusicListForRemoteRestore } from "../../renderer/core/backup-resume/dedupe-remote-restore";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function runTests(): void {
    const items = dedupeMusicListForRemoteRestore([
        {
            platform: "bimiao",
            id: "1",
            title: "Song",
            artist: "Artist",
            album: "Album",
            duration: 0,
        },
        {
            platform: "WebDAV",
            id: "/music/song.flac",
            title: "Song",
            artist: "Artist",
            album: "Album",
            duration: 0,
        },
    ] as Array<{
        platform: string;
        id: string;
        title: string;
        artist: string;
        album: string;
        duration: number;
    }>);

    assert(items.length === 1, "collapses title+artist duplicates");
    assert(items[0]?.platform === "WebDAV", "WebDAV wins over stream id");
}

runTests();
