import {
    pluginMetaToBackupOrder,
    type IBackupPayload,
} from "../../renderer/core/backup-resume/types";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function runPluginMetaToBackupOrderTests(): void {
    assert(pluginMetaToBackupOrder(undefined) === undefined, "undefined → omit");
    assert(pluginMetaToBackupOrder(null) === undefined, "null → omit");
    assert(pluginMetaToBackupOrder({}) === undefined, "empty meta → omit");

    assert(
        pluginMetaToBackupOrder({
            A: {},
            B: { userVariables: { k: "v" } },
            C: { order: Number.NaN },
            "": { order: 0 },
        }) === undefined,
        "no finite orders → omit",
    );

    const order = pluginMetaToBackupOrder({
        "网易(bimiao音源)": { order: 0, userVariables: { u: "1" } },
        Ciallo: { order: 1 },
        WebDAV: { order: 2 },
        skip: { order: Number.POSITIVE_INFINITY },
        noOrder: { userVariables: {} },
    });
    assert(order !== undefined, "finite orders kept");
    assert(order!["网易(bimiao音源)"] === 0, "platform 0");
    assert(order!.Ciallo === 1, "platform 1");
    assert(order!.WebDAV === 2, "platform 2");
    assert(!("skip" in order!), "non-finite dropped");
    assert(!("noOrder" in order!), "missing order dropped");
    assert(!("" in order!), "empty key dropped");
}

/**
 * WebDAV upload attaches syncMeta via object spread; pluginOrder must survive.
 * Mirrors withWebdavUploadSyncMeta shape without importing AppConfig.
 */
function runWebdavSpreadPreservesOrderTests(): void {
    const base: IBackupPayload = {
        musicSheets: [],
        plugins: [{ srcUrl: "https://example.com/p.js", version: "1.0.0" }],
        pluginOrder: { WebDAV: 0, Other: 1 },
    };
    const withMeta: IBackupPayload = {
        ...base,
        syncMeta: { updatedAt: 1, sourceDeviceId: "test-device" },
    };
    assert(withMeta.pluginOrder?.WebDAV === 0, "spread keeps WebDAV order");
    assert(withMeta.pluginOrder?.Other === 1, "spread keeps Other order");
    assert(withMeta.syncMeta?.sourceDeviceId === "test-device", "syncMeta set");
}

function runTests(): void {
    runPluginMetaToBackupOrderTests();
    runWebdavSpreadPreservesOrderTests();
}

runTests();
