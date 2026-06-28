import {
    buildRenamedAudioFilename,
    getAudioExtension,
    localSidecarPathsForAudio,
} from "../rename-download-path";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function runTests(): void {
    assert(getAudioExtension("最后一页@江语晨.flac") === "flac", "basename ext");
    assert(
        getAudioExtension("/Music/Download/最后一页@江语晨.flac") === "flac",
        "path ext",
    );
    assert(getAudioExtension("noextension") === "mp3", "default ext");

    assert(
        buildRenamedAudioFilename(
            "【4K120FPS】@林距离音乐君.flac",
            "飞云之下",
            "林俊杰&韩红",
        ) === "飞云之下@林俊杰&韩红.flac",
        "renamed filename",
    );
    assert(
        buildRenamedAudioFilename("song@artist", "song", "artist") ===
            "song@artist.mp3",
        "extension fallback on basename without dot",
    );

    const sidecars = localSidecarPathsForAudio(
        "/home/user/Downloads/最后一页@江语晨.flac",
    );
    assert(
        sidecars.lrcPath === "/home/user/Downloads/最后一页@江语晨.lrc",
        "local lrc path",
    );
    assert(
        sidecars.tranLrcPath ===
            "/home/user/Downloads/最后一页@江语晨.tran.lrc",
        "local tran lrc path",
    );
}

runTests();
