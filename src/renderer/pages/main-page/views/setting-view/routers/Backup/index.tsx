import "./index.scss";
import { useEffect, useState } from "react";
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
import {
    getVerifiedRemoteTransportStatus,
    subscribeVerifiedRemoteTransport,
    type VerifiedRemoteTransportViewStatus,
} from "@shared/remote-storage/verified-remote-transport-store";
import {
    getRemoteMusicPath,
    isPcloudTokenFieldPresentButInvalidInConfig,
    isRemoteCredentialsCompleteInConfig,
} from "@shared/remote-storage/remote-config";

const PCLOUD_HOSTNAME_OPTIONS = [
    "api.pcloud.com",
    "eapi.pcloud.com",
] as const;

type TransportBannerStatus = VerifiedRemoteTransportViewStatus;

function renderTransportStatusValue(
    status: TransportBannerStatus,
    t: (key: string) => string,
): string {
    switch (status) {
        case "checking":
            return t("settings.backup.remote_transport_status_checking");
        case "pcloud":
            return t("settings.backup.remote_transport_status_pcloud");
        case "webdav":
            return t("settings.backup.remote_transport_status_webdav");
        case "both_offline":
            return t("settings.backup.remote_transport_status_both_offline");
        case "offline":
            return t("settings.backup.remote_transport_status_offline");
        default:
            return t("settings.backup.remote_transport_status_none");
    }
}

export default function Backup() {
    const { t } = useTranslation();
    useAppConfig("backup.webdav.url");
    useAppConfig("backup.webdav.rootPath");
    useAppConfig("backup.webdav.username");
    useAppConfig("backup.webdav.password");
    useAppConfig("backup.remote.pcloud.hostname");
    useAppConfig("backup.remote.pcloud.tokenJson");
    useAppConfig("backup.remote.musicPath");

    const config = AppConfig.getAllConfig();
    const [verifiedStatus, setVerifiedStatus] = useState<TransportBannerStatus>(
        getVerifiedRemoteTransportStatus(),
    );
    const remoteCredentialsComplete =
        isRemoteCredentialsCompleteInConfig(config);
    const pcloudTokenInvalid =
        isPcloudTokenFieldPresentButInvalidInConfig(config);
    const musicPathSet = Boolean(getRemoteMusicPath(config));

    useEffect(() => subscribeVerifiedRemoteTransport(setVerifiedStatus), []);

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
            <div className="remote-backup-container">
                <div
                    className="remote-backup-transport-status"
                    data-transport={verifiedStatus}
                >
                    <span className="remote-backup-transport-status-label">
                        {t("settings.backup.remote_transport_status_label")}
                    </span>
                    <span className="remote-backup-transport-status-value">
                        {renderTransportStatusValue(verifiedStatus, t)}
                    </span>
                </div>
                <div className="remote-backup-subsection-label">
                    {t("settings.backup.pcloud_api")}
                </div>
                <div className="remote-backup-full-width">
                    <RadioGroupSettingItem
                        keyPath="backup.remote.pcloud.hostname"
                        label={t("settings.backup.pcloud_hostname")}
                        options={[...PCLOUD_HOSTNAME_OPTIONS]}
                        renderItem={(hostname) =>
                            hostname === "eapi.pcloud.com"
                                ? t("settings.backup.pcloud_hostname_eu")
                                : t("settings.backup.pcloud_hostname_us")
                        }
                    ></RadioGroupSettingItem>
                </div>
                <div className="remote-backup-full-width">
                    <InputSettingItem
                        width="100%"
                        label={t("settings.backup.pcloud_token_json")}
                        type="password"
                        trim
                        keyPath="backup.remote.pcloud.tokenJson"
                    ></InputSettingItem>
                </div>
                {pcloudTokenInvalid ? (
                    <div className="label-container remote-backup-hint">
                        {t("settings.backup.pcloud_token_invalid_hint")}
                    </div>
                ) : null}
                <div className="remote-backup-subsection-label">
                    {t("settings.backup.webdav_credentials")}
                </div>
                <InputSettingItem
                    width="100%"
                    label={t("settings.backup.webdav_server_url")}
                    trim
                    keyPath="backup.webdav.url"
                ></InputSettingItem>
                <InputSettingItem
                    width="100%"
                    label={t("settings.backup.webdav_root_path")}
                    trim
                    keyPath="backup.webdav.rootPath"
                ></InputSettingItem>
                <div className="label-container remote-backup-hint">
                    {t("settings.backup.webdav_root_path_hint")}
                </div>
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
                <div className="remote-backup-full-width">
                    <InputSettingItem
                        width="100%"
                        label={t("settings.backup.remote_music_path")}
                        trim
                        keyPath="backup.remote.musicPath"
                    ></InputSettingItem>
                </div>
                {!remoteCredentialsComplete ? (
                    <div className="label-container remote-backup-hint">
                        {t("settings.backup.remote_credentials_incomplete_hint")}
                    </div>
                ) : null}
                {remoteCredentialsComplete && !musicPathSet ? (
                    <div className="label-container remote-backup-hint">
                        {t("settings.backup.remote_music_path_hint")}
                    </div>
                ) : null}
                <div className="remote-backup-priority-hint">
                    {t("settings.backup.pcloud_priority_hint")}
                </div>
                <div className="remote-backup-full-width">
                    <CheckBoxSettingItem
                        keyPath="backup.remote.autoSync"
                        label={t("settings.backup.remote_auto_sync")}
                        onChange={(event, checked) => {
                            if (checked && !remoteCredentialsComplete) {
                                event.preventDefault();
                                toast.error(
                                    t("settings.backup.remote_auto_sync_requires_credentials"),
                                );
                            }
                        }}
                    ></CheckBoxSettingItem>
                </div>
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
