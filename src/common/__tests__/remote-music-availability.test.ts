import {
    getRemoteMusicPath,
    isRemoteCredentialsCompleteInConfig,
    isRemoteMusicAvailableInConfig,
} from "../../shared/remote-storage/remote-config";
import type { IAppConfig } from "@/types/app-config";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function webdavConfig(
    overrides: Partial<IAppConfig> = {},
): IAppConfig {
    return {
        "backup.webdav.url": "https://dav.example.com",
        "backup.webdav.username": "user",
        "backup.webdav.password": "pass",
        ...overrides,
    };
}

function testUnavailableWithoutCredentials(): void {
    const config: IAppConfig = {
        "backup.webdav.url": "",
        "backup.webdav.username": "",
        "backup.webdav.password": "",
        "backup.remote.musicPath": "/Music/Download",
    };
    assert(
        !isRemoteMusicAvailableInConfig(config),
        "missing credentials should disable remote music",
    );
}

function testUnavailableWithEmptyMusicPath(): void {
    const config = webdavConfig({
        "backup.remote.musicPath": "",
    });
    assert(
        isRemoteCredentialsCompleteInConfig(config),
        "webdav creds should be complete",
    );
    assert(
        !isRemoteMusicAvailableInConfig(config),
        "empty musicPath should disable remote music",
    );
}

function testAvailableWithWebdavAndMusicPath(): void {
    const config = webdavConfig({
        "backup.remote.musicPath": "/(Reinstall)/BACKUP/MusicFree/Download",
    });
    assert(
        isRemoteMusicAvailableInConfig(config),
        "webdav creds + musicPath should enable remote music",
    );
    assert(
        getRemoteMusicPath(config) === "/(Reinstall)/BACKUP/MusicFree/Download",
        "musicPath should be read from config",
    );
}

function testAvailableWithPcloudAndMusicPath(): void {
    const config: IAppConfig = {
        "backup.remote.pcloud.hostname": "eapi.pcloud.com",
        "backup.remote.pcloud.tokenJson": "{\"access_token\":\"tok\",\"token_type\":\"bearer\"}",
        "backup.remote.musicPath": "/Music/Download",
    };
    assert(
        isRemoteMusicAvailableInConfig(config),
        "pcloud creds + musicPath should enable remote music",
    );
}

function run(): void {
    testUnavailableWithoutCredentials();
    testUnavailableWithEmptyMusicPath();
    testAvailableWithWebdavAndMusicPath();
    testAvailableWithPcloudAndMusicPath();
}

run();
