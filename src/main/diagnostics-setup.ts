import { ipcMain } from "electron";
import log from "electron-log/main";
import { DIAGNOSTICS_IPC_CHANNEL } from "@shared/diagnostics/channel";

/**
 * Call once at main process startup (before creating windows).
 * Enables renderer/preload logging via electron-log and captures fatal errors.
 */
export function setupDiagnostics(): void {
    try {
        log.initialize({ spyRendererConsole: true });
    } catch {
        // initialize is safe to skip if already configured
    }

    try {
        const file = log.transports.file.getFile();
        log.info(
            "[diag][main] diagnostics active; main log file:",
            file?.path ?? "(unknown)",
        );
    } catch {
        log.info("[diag][main] diagnostics active (file path unavailable)");
    }

    ipcMain.on(DIAGNOSTICS_IPC_CHANNEL, (_evt, payload: unknown) => {
        try {
            log.info("[diag][preload]", JSON.stringify(payload));
        } catch {
            log.info("[diag][preload]", String(payload));
        }
    });

    process.on("uncaughtException", (err) => {
        log.error("[diag][main] uncaughtException", err);
    });

    process.on("unhandledRejection", (reason) => {
        log.error("[diag][main] unhandledRejection", reason);
    });
}
