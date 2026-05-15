import MusicSheet from "@/renderer/core/music-sheet";
import BackupResume from "@/renderer/core/backup-resume";
import AppConfig from "@shared/app-config/renderer";
import { AuthType, createClient } from "webdav";
import type { TFunction } from "i18next";
import { toast } from "react-toastify";

function getErrorReason(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

const WEBDAV_BACKUP_DIR = "/MusicFree";
const WEBDAV_BACKUP_FILE = "/MusicFree/MusicFreeBackup.json";

function createWebdavClient(t: TFunction) {
    const url = AppConfig.getConfig("backup.webdav.url");
    const username = AppConfig.getConfig("backup.webdav.username");
    const password = AppConfig.getConfig("backup.webdav.password");

    if (!url || !username || !password) {
        throw new Error(t("settings.backup.webdav_data_not_complete"));
    }

    return createClient(url, {
        authType: AuthType.Password,
        username,
        password,
    });
}

export async function backupMusicSheetsToWebdav(t: TFunction) {
    const client = createWebdavClient(t);
    const sheetDetails = await MusicSheet.frontend.exportAllSheetDetails();
    const backUp = JSON.stringify({ musicSheets: sheetDetails }, undefined, 0);

    if (!(await client.exists(WEBDAV_BACKUP_DIR))) {
        await client.createDirectory(WEBDAV_BACKUP_DIR);
    }

    await client.putFileContents(WEBDAV_BACKUP_FILE, backUp, { overwrite: true });
}

export async function restoreMusicSheetsFromWebdav(t: TFunction) {
    const client = createWebdavClient(t);

    if (!(await client.exists(WEBDAV_BACKUP_FILE))) {
        throw new Error(t("settings.backup.webdav_backup_file_not_exist"));
    }

    const resumeData = await client.getFileContents(WEBDAV_BACKUP_FILE, {
        format: "text",
    });

    await BackupResume.resume(
        resumeData,
        AppConfig.getConfig("backup.resumeBehavior") === "overwrite",
    );
}

export async function backupMusicSheetsToWebdavWithToast(t: TFunction) {
    try {
        await backupMusicSheetsToWebdav(t);
        toast.success(t("settings.backup.backup_success"));
    } catch (error) {
        toast.error(
            t("settings.backup.backup_fail", {
                reason: getErrorReason(error),
            }),
        );
    }
}

export async function restoreMusicSheetsFromWebdavWithToast(t: TFunction) {
    try {
        await restoreMusicSheetsFromWebdav(t);
        toast.success(t("settings.backup.resume_success"));
    } catch (error) {
        toast.error(
            t("settings.backup.resume_fail", {
                reason: getErrorReason(error),
            }),
        );
    }
}
