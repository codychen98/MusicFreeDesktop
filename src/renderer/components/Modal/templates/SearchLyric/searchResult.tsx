import { memo } from "react";
import { ISearchLyricResult } from "./hooks/searchResultStore";
import { If } from "@/renderer/components/Condition";
import { RequestStateCode } from "@/common/constant";
import Loading from "@/renderer/components/Loading";
import albumImg from "@/assets/imgs/album-cover.jpg";
import { setFallbackAlbum } from "@/renderer/utils/img-on-error";
import Empty from "@/renderer/components/Empty";
import "./searchResult.scss";
import {
    SaveSearchedLyricError,
    SaveSearchedLyricErrorCode,
    saveSearchedLyric,
} from "@/renderer/core/save-searched-lyric";
import { WEBDAV_MUSIC_PLUGIN_PLATFORM } from "@/renderer/core/webdav-download/config";
import { getMediaPrimaryKey } from "@/common/media-util";
import { toast } from "react-toastify";
import { hideModal } from "../..";
import { useTranslation } from "react-i18next";
import trackPlayer from "@renderer/core/track-player";
import type { TFunction } from "i18next";

interface ISearchResultProps {
    data: ISearchLyricResult;
    musicItem?: IMusic.IMusicItem;
}

function resolveSaveLyricErrorMessage(
    error: unknown,
    t: TFunction,
): string {
    if (error instanceof SaveSearchedLyricError) {
        switch (error.code) {
            case SaveSearchedLyricErrorCode.WEBDAV_CONFIG_INCOMPLETE:
                return t("modal.media_lyric_save_webdav_config_incomplete");
            case SaveSearchedLyricErrorCode.LYRIC_EMPTY:
                return t("modal.media_lyric_save_empty");
            case SaveSearchedLyricErrorCode.UPLOAD_FAILED:
                return t("modal.media_lyric_save_upload_failed");
            default:
                return t("modal.media_lyric_save_failed");
        }
    }
    if (error instanceof Error && error.message) {
        return `${t("modal.media_lyric_save_failed")} ${error.message}`;
    }
    return t("modal.media_lyric_save_failed");
}

function SearchResult(props: ISearchResultProps) {
    const { data, musicItem } = props;

    const { t } = useTranslation();

    return (
        <div className="search-result-container">
            <If
                condition={
                    data?.state && data.state & RequestStateCode.PENDING_FIRST_PAGE
                }
            >
                <If.Truthy>
                    <Loading></Loading>
                </If.Truthy>
                <If.Falsy>
                    <div className="search-result-falsy-container">
                        {
                            <If condition={data?.data?.length}>
                                <If.Truthy>
                                    {(data?.data ?? []).map((it) => (
                                        <div
                                            className="lyric-item"
                                            key={getMediaPrimaryKey(it)}
                                            role="button"
                                            onClick={async () => {
                                                if (musicItem) {
                                                    try {
                                                        await saveSearchedLyric(
                                                            musicItem,
                                                            it,
                                                        );
                                                        if (
                                                            trackPlayer.isCurrentMusic(
                                                                musicItem,
                                                            )
                                                        ) {
                                                            trackPlayer.fetchCurrentLyric(
                                                                true,
                                                            );
                                                        }
                                                        const successKey =
                                                            musicItem.platform ===
                                                            WEBDAV_MUSIC_PLUGIN_PLATFORM
                                                                ? "modal.media_lyric_webdav_saved"
                                                                : "modal.media_lyric_linked";
                                                        toast.success(t(successKey));
                                                        hideModal();
                                                    } catch (e) {
                                                        toast.error(
                                                            resolveSaveLyricErrorMessage(
                                                                e,
                                                                t,
                                                            ),
                                                        );
                                                    }
                                                }
                                            }}
                                        >
                                            <img
                                                src={it.artwork ?? albumImg}
                                                onError={setFallbackAlbum}
                                            ></img>
                                            <div className="lyric-info">
                                                <div className="title">{it.title}</div>
                                                <div className="artist">{it.artist}</div>
                                            </div>
                                        </div>
                                    ))}
                                </If.Truthy>
                                <If.Falsy>
                                    <Empty></Empty>
                                </If.Falsy>
                            </If>
                        }
                    </div>
                </If.Falsy>
            </If>
        </div>
    );
}

export default memo(SearchResult, (prev, curr) => prev.data === curr.data);
