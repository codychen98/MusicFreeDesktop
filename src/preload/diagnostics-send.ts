import { ipcRenderer } from "electron";
import { DIAGNOSTICS_IPC_CHANNEL } from "@shared/diagnostics/channel";

export type DiagnosticsPayload = {
    scope: string;
    detail?: string;
    ms?: number;
};

export function sendDiagnostics(payload: DiagnosticsPayload): void {
    try {
        ipcRenderer.send(DIAGNOSTICS_IPC_CHANNEL, {
            ...payload,
            t: Date.now(),
        });
    } catch {
        // ignore if IPC not ready
    }
}
