import "./index.scss";
import { toast } from "react-toastify";
import RadioGroupSettingItem from "../../components/RadioGroupSettingItem";
import InputSettingItem from "../../components/InputSettingItem";
import CheckBoxSettingItem from "../../components/CheckBoxSettingItem";
import BackupResume from "@/renderer/core/backup-resume";
import {
    backupMusicSheetsToWebdavWithToast,
    restoreMusicSheetsFromWebdavWithToast,
} from "@/renderer/core/webdav-backup";
import { useTranslation } from "react-i18next";
import AppConfig from "@shared/app-config/renderer";
import useAppConfig from "@/hooks/useAppConfig";
import { dialogUtil, fsUtil } from "@shared/utils/renderer";



export default function Backup() {
    const { t } = useTranslation();
    const webdavUrl = useAppConfig("backup.webdav.url");
    const webdavUsername = useAppConfig("backup.webdav.username");
    const webdavPassword = useAppConfig("backup.webdav.password");
    const webdavCredentialsComplete = Boolean(
        webdavUrl?.trim() && webdavUsername?.trim() && webdavPassword?.trim(),
    );


    function onBackupClick() {
        return backupMusicSheetsToWebdavWithToast(t);
    }

    function onResumeClick() {
        return restoreMusicSheetsFromWebdavWithToast(t);
    }

    return (
        <div className="setting-view--backup-container">
            <RadioGroupSettingItem
                keyPath="backup.resumeBehavior"
                options={[
                    "append",
                    "overwrite",
                ]}
                renderItem={(item) => t("settings.backup.resume_mode_" + item)}
            ></RadioGroupSettingItem>
            <div className={"label-container"}>
                {t("settings.backup.backup_by_file")}
            </div>
            <div className="setting-row backup-row">
                <div
                    role="button"
                    data-type="normalButton"
                    onClick={async () => {
                        const result = await dialogUtil.showSaveDialog({
                            properties: ["showOverwriteConfirmation", "createDirectory"],
                            filters: [
                                {
                                    name: t("settings.backup.musicfree_backup_file"),
                                    extensions: ["json", "txt"],
                                },
                            ],
                            title: t("settings.backup.backup_to"),
                        });
                        if (!result.canceled && result.filePath) {
                            const payload = await BackupResume.exportBackupPayload();
                            const backUp = BackupResume.serializeBackupPayload(payload);
                            await fsUtil.writeFile(result.filePath, backUp, "utf-8");
                            toast.success(t("settings.backup.backup_success"));
                        }
                    }}
                >
                    {t("settings.backup.backup_music_sheet")}
                </div>
                <div
                    role="button"
                    data-type="normalButton"
                    onClick={async () => {
                        const result = await dialogUtil.showOpenDialog({
                            properties: ["openFile"],
                            filters: [
                                {
                                    name: t("settings.backup.musicfree_backup_file"),
                                    extensions: ["json", "txt"],
                                },
                            ],
                            title: t("common.open"),
                        });
                        if (!result.canceled && result.filePaths) {
                            try {
                                const rawSheets = (await fsUtil.readFile(
                                    result.filePaths[0],
                                    "utf-8",
                                )) as string;

                                await BackupResume.resume(
                                    rawSheets,
                                    AppConfig.getConfig("backup.resumeBehavior") === "overwrite",
                                );

                                toast.success(t("backup.backup_success"));
                            } catch (e) {
                                toast.error(
                                    t("backup.backup_fail", {
                                        reason: e?.message,
                                    }),
                                );
                            }
                        }
                    }}
                >
                    {t("settings.backup.resume_music_sheet")}
                </div>
            </div>
            <div className={"label-container setting-row"}>
                {t("settings.backup.backup_by_webdav")}
            </div>
            <div className="webdav-backup-container">
                <InputSettingItem
                    width="100%"
                    label={t("settings.backup.webdav_server_url")}
                    trim
                    keyPath="backup.webdav.url"
                ></InputSettingItem>
                <InputSettingItem
                    width="100%"
                    label={t("settings.backup.username")}
                    trim
                    keyPath="backup.webdav.username"
                ></InputSettingItem>
                <InputSettingItem
                    width="100%"
                    label={t("settings.backup.password")}
                    type="password"
                    trim
                    keyPath="backup.webdav.password"
                ></InputSettingItem>
                <CheckBoxSettingItem
                    keyPath="backup.webdav.autoSync"
                    label={t("settings.backup.webdav_auto_sync")}
                    onChange={(event, checked) => {
                        if (checked && !webdavCredentialsComplete) {
                            event.preventDefault();
                            toast.error(
                                t("settings.backup.webdav_auto_sync_requires_credentials"),
                            );
                        }
                    }}
                ></CheckBoxSettingItem>
                {!webdavCredentialsComplete ? (
                    <div className="label-container webdav-auto-sync-hint">
                        {t("settings.backup.webdav_auto_sync_credentials_hint")}
                    </div>
                ) : null}
            </div>
            <div className="setting-row backup-row">
                <div
                    role="button"
                    data-type="normalButton"
                    onClick={onBackupClick}
                >
                    {t("settings.backup.backup_music_sheet")}
                </div>
                <div
                    role="button"
                    data-type="normalButton"
                    onClick={onResumeClick}
                >
                    {t("settings.backup.resume_music_sheet")}
                </div>
            </div>
        </div>
    );
}
