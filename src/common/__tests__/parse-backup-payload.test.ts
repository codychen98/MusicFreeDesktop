import {
    parseBackupPayload,
    parsePluginOrder,
} from "../../renderer/core/backup-resume/types";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function runParsePluginOrderTests(): void {
    assert(parsePluginOrder(undefined) === undefined, "undefined → omit");
    assert(parsePluginOrder(null) === undefined, "null → omit");
    assert(parsePluginOrder("nope") === undefined, "string → omit");
    assert(parsePluginOrder([0, 1]) === undefined, "array → omit");
    assert(parsePluginOrder({}) === undefined, "empty object → omit");

    assert(
        parsePluginOrder({ a: "0", b: null, c: Number.NaN }) === undefined,
        "all-invalid entries → omit",
    );

    const mixed = parsePluginOrder({
        "网易(bimiao音源)": 0,
        "Ciallo": 1,
        WebDAV: 2,
        bad: "x",
        "": 9,
        skip: Number.POSITIVE_INFINITY,
    });
    assert(mixed !== undefined, "mixed keeps finite entries");
    assert(mixed!["网易(bimiao音源)"] === 0, "order key 0");
    assert(mixed!["Ciallo"] === 1, "order key 1");
    assert(mixed!.WebDAV === 2, "order key 2");
    assert(!("bad" in mixed!), "string value dropped");
    assert(!("" in mixed!), "empty key dropped");
    assert(!("skip" in mixed!), "non-finite dropped");
}

function runParseBackupPayloadTests(): void {
    const legacy = parseBackupPayload({
        musicSheets: [{ id: "s1" }],
        plugins: [{ srcUrl: "https://example.com/p.js", version: "1.0.0" }],
    });
    assert(legacy.musicSheets.length === 1, "legacy sheets kept");
    assert(legacy.plugins.length === 1, "legacy plugins kept");
    assert(legacy.pluginOrder === undefined, "legacy omits pluginOrder");

    const withOrder = parseBackupPayload(
        JSON.stringify({
            musicSheets: [],
            plugins: [],
            pluginOrder: { WebDAV: 0, Other: 1 },
            syncMeta: { updatedAt: 123 },
        }),
    );
    assert(withOrder.pluginOrder?.WebDAV === 0, "string JSON pluginOrder");
    assert(withOrder.pluginOrder?.Other === 1, "string JSON second key");
    assert(withOrder.syncMeta?.updatedAt === 123, "syncMeta still parsed");

    const invalidOrder = parseBackupPayload({
        musicSheets: [],
        plugins: [],
        pluginOrder: "not-a-map",
    });
    assert(
        invalidOrder.pluginOrder === undefined,
        "invalid pluginOrder ignored",
    );
    assert(Array.isArray(invalidOrder.musicSheets), "sheets still array");
    assert(Array.isArray(invalidOrder.plugins), "plugins still array");

    const filtersBadPlugins = parseBackupPayload({
        musicSheets: "x",
        plugins: [{ srcUrl: "", version: "1" }, { version: "2" }, null],
        pluginOrder: { A: 0 },
    });
    assert(filtersBadPlugins.musicSheets.length === 0, "bad sheets → []");
    assert(filtersBadPlugins.plugins.length === 0, "bad plugins filtered");
    assert(filtersBadPlugins.pluginOrder?.A === 0, "valid order kept");
}

function runTests(): void {
    runParsePluginOrderTests();
    runParseBackupPayloadTests();
}

runTests();
