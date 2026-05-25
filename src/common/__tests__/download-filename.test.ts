import {
    buildDownloadBasename,
    parseDownloadBasename,
} from "../download-filename";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function runTests(): void {
    assert(
        buildDownloadBasename({ title: "最后一页", artist: "江语晨" }) ===
            "最后一页@江语晨",
        "v2 basename",
    );

    const legacy = parseDownloadBasename("网易(a)@1@最后一页@江语晨");
    assert(legacy?.format === "legacy", "legacy format");
    assert(legacy?.title === "最后一页", "legacy title");
    assert(legacy?.artist === "江语晨", "legacy artist");

    const v2 = parseDownloadBasename("最后一页@江语晨");
    assert(v2?.format === "v2", "v2 format");
    assert(v2?.title === "最后一页" && v2?.artist === "江语晨", "v2 fields");

    const artistAt = parseDownloadBasename("a@b@c@d@e@f");
    assert(artistAt?.format === "legacy", "legacy with many @");
}

runTests();
