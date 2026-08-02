import {
    applyBackupOrderToPluginMeta,
    type IBackupPluginOrder,
} from "../../renderer/core/backup-resume/types";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function runNoOpTests(): void {
    const local = {
        A: { order: 0, userVariables: { k: "v" } },
        B: { order: 1 },
    };
    assert(
        applyBackupOrderToPluginMeta(local, undefined) === undefined,
        "undefined pluginOrder → no-op",
    );
}

function runRemoteWinsTests(): void {
    const local: Record<string, IPlugin.IPluginMeta> = {
        A: { order: 9, userVariables: { k: "v" } },
        B: { order: 1 },
        C: { order: 2, userVariables: { x: "1" } },
    };
    const remote: IBackupPluginOrder = {
        A: 0,
        WebDAV: 1,
        "网易(bimiao音源)": 2,
    };

    const next = applyBackupOrderToPluginMeta(local, remote);
    assert(next !== undefined, "applies when remote present");
    assert(next!.A.order === 0, "A order replaced");
    assert(next!.A.userVariables?.k === "v", "A userVariables preserved");
    assert(next!.WebDAV?.order === 1, "new remote platform persisted");
    assert(next!["网易(bimiao音源)"]?.order === 2, "unicode platform persisted");
    assert(next!.B === undefined, "local-only order-only entry dropped");
    assert(next!.C.order === undefined, "local-only platform loses order");
    assert(next!.C.userVariables?.x === "1", "local-only userVariables kept");
}

function runEmptyLocalTests(): void {
    const next = applyBackupOrderToPluginMeta(undefined, {
        WebDAV: 0,
        Other: 1,
    });
    assert(next !== undefined, "works with empty local meta");
    assert(next!.WebDAV.order === 0, "WebDAV order set");
    assert(next!.Other.order === 1, "Other order set");
}

function runTests(): void {
    runNoOpTests();
    runRemoteWinsTests();
    runEmptyLocalTests();
}

runTests();
