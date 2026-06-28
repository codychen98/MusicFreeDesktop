import { useState } from "react";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";

import useMounted from "@/hooks/useMounted";
import Condition from "@/renderer/components/Condition";
import Loading from "@/renderer/components/Loading";
import {
    RenameTrackError,
    renameMusicTrack,
} from "@/renderer/core/rename-track";
import { WebdavMusicPluginConfigIncompleteError } from "@/renderer/core/webdav-download/upload";

import { hideModal } from "../..";
import Base from "../Base";
import "./index.scss";

interface IProps {
    musicItem: IMusic.IMusicItem;
}

function resolveRenameErrorMessage(
    error: unknown,
    t: (key: string) => string,
): string {
    if (error instanceof RenameTrackError) {
        switch (error.code) {
            case "RENAME_TARGET_EXISTS":
                return t("music_list_context_menu.rename_track_target_exists");
            case "RENAME_INVALID_INPUT":
                return t("music_list_context_menu.rename_track_invalid_input");
            default:
                return t("music_list_context_menu.rename_track_failed");
        }
    }
    if (
        error instanceof WebdavMusicPluginConfigIncompleteError ||
        (error instanceof Error &&
            error.message === "WEBDAV_MUSIC_PLUGIN_CONFIG_INCOMPLETE")
    ) {
        return t("music_list_context_menu.rename_track_webdav_config_incomplete");
    }
    if (error instanceof Error && error.message) {
        return `${t("music_list_context_menu.rename_track_failed")} ${error.message}`;
    }
    return t("music_list_context_menu.rename_track_failed");
}

export default function RenameMusicTrack(props: IProps) {
    const { musicItem } = props;
    const { t } = useTranslation();
    const isMounted = useMounted();
    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState(musicItem.title ?? "");
    const [artist, setArtist] = useState(musicItem.artist ?? "");
    const canSubmit = title.trim().length > 0 && artist.trim().length > 0;

    const handleConfirm = async () => {
        if (!canSubmit || loading) {
            return;
        }
        setLoading(true);
        try {
            await renameMusicTrack(musicItem, {
                title: title.trim(),
                artist: artist.trim(),
            });
            if (!isMounted.current) {
                return;
            }
            toast.success(t("music_list_context_menu.rename_track_success"));
            hideModal();
        } catch (error: unknown) {
            if (!isMounted.current) {
                return;
            }
            toast.error(resolveRenameErrorMessage(error, t));
            setLoading(false);
        }
    };

    return (
        <Base withBlur={false}>
            <div className="modal--rename-music-track shadow backdrop-color">
                <Base.Header>{t("modal.rename_track")}</Base.Header>
                <Condition
                    condition={!loading}
                    falsy={
                        <Loading
                            text={t("music_list_context_menu.rename_track_loading")}
                        />
                    }
                >
                    <div className="input-area">
                        <label className="field">
                            <span className="field-label">
                                {t("modal.rename_track_title_label")}
                            </span>
                            <input
                                autoFocus
                                placeholder={t(
                                    "modal.rename_track_title_placeholder",
                                )}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        void handleConfirm();
                                    }
                                }}
                            />
                        </label>
                        <label className="field">
                            <span className="field-label">
                                {t("modal.rename_track_artist_label")}
                            </span>
                            <input
                                placeholder={t(
                                    "modal.rename_track_artist_placeholder",
                                )}
                                value={artist}
                                onChange={(e) => setArtist(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        void handleConfirm();
                                    }
                                }}
                            />
                        </label>
                    </div>
                    <div className="operation-area">
                        <div
                            role="button"
                            data-type="primaryButton"
                            data-disabled={!canSubmit}
                            onClick={() => {
                                void handleConfirm();
                            }}
                        >
                            {t("common.confirm")}
                        </div>
                    </div>
                </Condition>
            </div>
        </Base>
    );
}
