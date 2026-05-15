import { supportLocalMediaType } from "@/common/constant";
import { parseLocalMusicItem, safeStat } from "@/common/file-util";
import PluginManager from "@shared/plugin-manager/main";
import voidCallback from "@/common/void-callback";
import messageBus from "@shared/message-bus/main";
import type { ICommand } from "@shared/message-bus/type";

const playerActionCommands: Record<string, keyof ICommand> = {
    skipnext: "SkipToNext",
    skipprev: "SkipToPrevious",
    toggleplay: "TogglePlayerState",
    favorite: "Favorite",
    unfavorite: "Unfavorite",
    favoritetoggle: "ToggleFavorite",
    togglelyric: "ToggleDesktopLyric",
};

export function isPlayerDeepLink(url: string) {
    try {
        const urlObj = new URL(url);
        return urlObj.protocol === "musicfree:" && urlObj.hostname === "player";
    } catch {
        return false;
    }
}

export function handleDeepLink(url: string) {
    if (!url) {
        return;
    }

    try {
        const urlObj = new URL(url);
        if (urlObj.protocol === "musicfree:") {
            handleMusicFreeScheme(urlObj);
        }
    } catch {
        // pass
    }
}

async function handleMusicFreeScheme(url: URL) {
    const hostname = url.hostname;
    if (hostname === "install") {
        try {
            const pluginUrlStr =
                url.pathname.slice(1) || url.searchParams.get("plugin");
            const pluginUrls = pluginUrlStr.split(",").map(decodeURIComponent);
            await Promise.all(
                pluginUrls.map((it) => PluginManager.installPluginFromRemoteUrl(it).catch(voidCallback)),
            );
        } catch {
            // pass
        }
    } else if (hostname === "player") {
        const action = url.pathname.replace(/^\//, "").toLowerCase();
        const command = playerActionCommands[action];
        if (command) {
            messageBus.sendCommand(command);
        }
    }
}

async function handleBareUrl(url: string) {
    try {
        if (
            (await safeStat(url)).isFile() &&
            supportLocalMediaType.some((postfix) => url.endsWith(postfix))
        ) {
            const musicItem = await parseLocalMusicItem(url);
            messageBus.sendCommand("PlayMusic", musicItem);
        }
    } catch {
    }
}
