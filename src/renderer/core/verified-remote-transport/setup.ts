import AppConfig from "@shared/app-config/renderer";
import { getRemoteStorageCredentialsFromConfig } from "@shared/remote-storage/remote-config";
import { runVerifiedRemoteTransportProbe } from "@shared/remote-storage/verified-remote-transport-store";
import type { IAppConfig } from "@/types/app-config";

const REMOTE_CREDENTIAL_CONFIG_KEYS = [
    "backup.remote.pcloud.hostname",
    "backup.remote.pcloud.tokenJson",
    "backup.webdav.url",
    "backup.webdav.rootPath",
    "backup.webdav.username",
    "backup.webdav.password",
] as const satisfies readonly (keyof IAppConfig)[];

function remoteCredentialsChanged(patch: IAppConfig): boolean {
    return REMOTE_CREDENTIAL_CONFIG_KEYS.some((key) => key in patch);
}

export async function setupVerifiedRemoteTransport(): Promise<void> {
    const credentials = getRemoteStorageCredentialsFromConfig(
        AppConfig.getAllConfig(),
    );
    await runVerifiedRemoteTransportProbe(credentials, { force: true });

    AppConfig.onConfigUpdate((patch) => {
        if (!remoteCredentialsChanged(patch)) {
            return;
        }
        const nextCredentials = getRemoteStorageCredentialsFromConfig(
            AppConfig.getAllConfig(),
        );
        void runVerifiedRemoteTransportProbe(nextCredentials, { force: true });
    });
}
