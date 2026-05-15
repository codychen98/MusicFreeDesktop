import { compare } from "compare-versions";
import { localPluginHash } from "@/common/constant";
import PluginManager from "@shared/plugin-manager/renderer";
import type { IBackupPluginEntry } from "./types";

export function collectBackupPlugins(): IBackupPluginEntry[] {
    return PluginManager.getInstalledPluginDelegates()
        .filter((plugin) => plugin.hash !== localPluginHash && plugin.srcUrl)
        .map((plugin) => ({
            srcUrl: plugin.srcUrl as string,
            version: plugin.version ?? "",
        }));
}

export async function resumeBackupPlugins(
    plugins: IBackupPluginEntry[] | undefined,
) {
    if (!plugins?.length) {
        return;
    }

    const installed = PluginManager.getInstalledPluginDelegates();
    const installTasks = plugins.map(async (entry) => {
        const skip = installed.some(
            (plugin) =>
                plugin.srcUrl === entry.srcUrl &&
                compare(
                    plugin.version ?? "0.0.0",
                    entry.version ?? "0.0.1",
                    ">=",
                ),
        );
        if (skip) {
            return;
        }
        await PluginManager.installPluginFromRemote(entry.srcUrl);
    });

    await Promise.all(installTasks);
}
