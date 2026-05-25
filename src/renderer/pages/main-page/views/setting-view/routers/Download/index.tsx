import "./index.scss";
import RadioGroupSettingItem from "../../components/RadioGroupSettingItem";
import ListBoxSettingItem from "../../components/ListBoxSettingItem";
import Downloader from "@/renderer/core/downloader";
import PathSettingItem from "../../components/PathSettingItem";
import { useTranslation } from "react-i18next";
import useAppConfig from "@/hooks/useAppConfig";
import AppConfig from "@shared/app-config/renderer";
import {
    getWebdavDownloadTargetSummary,
    isWebdavDownloadTargetAvailable,
} from "@/renderer/core/webdav-download/config";
import { RadioGroup } from "@headlessui/react";
import SvgAsset from "@/renderer/components/SvgAsset";
import classNames from "@/renderer/utils/classnames";
import { toast } from "react-toastify";

const concurrencyList = Array(20)
    .fill(0)
    .map((_, index) => index + 1);

export default function Download() {
    const { t } = useTranslation();
    const destination =
        useAppConfig("download.destination") ?? "local";
    const webdavSummary = getWebdavDownloadTargetSummary();

    return (
        <div className="setting-view--download-container">
            <div className="setting-view--radio-group-setting-item-container setting-row">
                <RadioGroup
                    value={destination}
                    onChange={(val: "local" | "webdav") => {
                        if (
                            val === "webdav" &&
                            !isWebdavDownloadTargetAvailable()
                        ) {
                            toast.error(
                                t(
                                    "settings.download.webdav_destination_unavailable",
                                ),
                            );
                            return;
                        }
                        AppConfig.setConfig({ "download.destination": val });
                    }}
                >
                    <RadioGroup.Label className="label-container">
                        {t("settings.download.download_destination")}
                    </RadioGroup.Label>
                    <div
                        className="options-container"
                        style={{ flexDirection: "column" }}
                    >
                        {(["local", "webdav"] as const).map((option) => (
                            <RadioGroup.Option key={option} value={option}>
                                {({ checked }) => {
                                    const title =
                                        option === "webdav"
                                            ? t(
                                                "settings.download.download_destination_webdav",
                                            )
                                            : t(
                                                "settings.download.download_destination_local",
                                            );
                                    return (
                                        <div
                                            className={classNames({
                                                "option-item-container": true,
                                                highlight: checked,
                                            })}
                                            title={title}
                                        >
                                            <SvgAsset
                                                iconName={
                                                    checked
                                                        ? "check-circle-fill"
                                                        : "circle"
                                                }
                                            />
                                            <span>{title}</span>
                                        </div>
                                    );
                                }}
                            </RadioGroup.Option>
                        ))}
                    </div>
                </RadioGroup>
            </div>
            {destination === "local" ? (
                <PathSettingItem
                    keyPath="download.path"
                    label={t("settings.download.download_folder")}
                />
            ) : (
                <div className="label-container download-webdav-summary">
                    <div>{t("settings.download.webdav_plugin_folder")}</div>
                    <div className="download-webdav-summary-path">
                        {webdavSummary.available
                            ? webdavSummary.searchPathSegment ||
                              t("settings.download.webdav_search_path_empty")
                            : t("settings.download.webdav_destination_unavailable")}
                    </div>
                    <div className="download-webdav-summary-hint">
                        {t("settings.download.webdav_plugin_list_hint")}
                    </div>
                </div>
            )}
            <ListBoxSettingItem
                keyPath="download.concurrency"
                options={concurrencyList}
                onChange={(_evt, newConfig) => {
                    Downloader.setDownloadingConcurrency(newConfig);
                }}
                label={t("settings.download.max_concurrency")}
            />
            <RadioGroupSettingItem
                label={t("settings.download.default_download_quality")}
                keyPath="download.defaultQuality"
                options={["low", "standard", "high", "super"]}
                renderItem={(item) => t("media.music_quality_" + item)}
            />
            <RadioGroupSettingItem
                label={t("settings.download.when_quality_missing")}
                keyPath="download.whenQualityMissing"
                options={["lower", "higher"]}
                renderItem={(item) =>
                    t("settings.download.download_" + item + "_quality_version")
                }
            />
        </div>
    );
}
