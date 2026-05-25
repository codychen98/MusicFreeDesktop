import {
    getMediaPrimaryKey,
    getQualityOrder,
    isSameMedia,
    setInternalData,
} from "@/common/media-util";
import { buildDownloadBasename } from "@/common/download-filename";
import * as Comlink from "comlink";
import { DownloadState, localPluginName } from "@/common/constant";
import PQueue from "p-queue";
import {
    addDownloadedMusicToList,
    isDownloaded,
    removeDownloadedMusic,
    setupDownloadedMusicList,
    useDownloaded,
    useDownloadedMusicList,
} from "./downloaded-sheet";
import { getGlobalContext } from "@/shared/global-context/renderer";
import Store from "@/common/store";
import { useEffect, useState } from "react";
import { DownloadEvts, ee } from "./ee";
import AppConfig from "@shared/app-config/renderer";
import PluginManager from "@shared/plugin-manager/renderer";
import { fsUtil } from "@shared/utils/renderer";
import {
    isWebdavDownloadTargetAvailable,
} from "@/renderer/core/webdav-download/config";
import { uploadDownloadArtifacts } from "@/renderer/core/webdav-download/upload";
import { migrateTrackToWebdavSource } from "@/renderer/core/migrate-track-to-webdav-source";
import { toast } from "react-toastify";
import { i18n } from "@/shared/i18n/renderer";

export interface IDownloadStatus {
    state: DownloadState;
    downloaded?: number;
    total?: number;
    msg?: string;
}

interface SidecarLyricPaths {
    lrcPath?: string;
    tranLrcPath?: string;
}

const downloadingMusicStore = new Store<Array<IMusic.IMusicItem>>([]);
const downloadingProgress = new Map<string, IDownloadStatus>();

type ProxyMarkedFunction<T extends (...args: any) => void> = T &
  Comlink.ProxyMarked;

type IOnStateChangeFunc = (data: IDownloadStatus) => void;

interface IDownloaderWorker {
    downloadFile: (
        mediaSource: IMusic.IMusicSource,
        filePath: string,
        onStateChange: ProxyMarkedFunction<IOnStateChangeFunc>,
    ) => Promise<void>;
}

let downloaderWorker: IDownloaderWorker;

async function setupDownloader() {
    setupDownloaderWorker();
    setupDownloadedMusicList();
}

function setupDownloaderWorker() {
    const downloaderWorkerPath = getGlobalContext().workersPath.downloader;
    if (downloaderWorkerPath) {
        const worker = new Worker(downloaderWorkerPath);
        downloaderWorker = Comlink.wrap(worker);
    }
    setDownloadingConcurrency(AppConfig.getConfig("download.concurrency"));
}

const concurrencyLimit = 20;
const downloadingQueue = new PQueue({
    concurrency: 5,
});

function setDownloadingConcurrency(concurrency: number) {
    if (isNaN(concurrency)) {
        return;
    }
    downloadingQueue.concurrency = Math.min(
        concurrency < 1 ? 1 : concurrency,
        concurrencyLimit,
    );
}

function shouldUseWebdavDownloadDestination(): boolean {
    const destination =
        AppConfig.getConfig("download.destination") ?? "local";
    return destination === "webdav" && isWebdavDownloadTargetAvailable();
}

async function ensureDirectory(dirPath: string): Promise<void> {
    try {
        await fsUtil.mkdir(dirPath, { recursive: true });
    } catch {
        // pass
    }
}

async function writeSidecarLyrics(
    musicItem: IMusic.IMusicItem,
    audioPath: string,
): Promise<SidecarLyricPaths> {
    try {
        const lrcSource = await PluginManager.callPluginDelegateMethod(
            musicItem,
            "getLyric",
            musicItem,
        );
        if (!lrcSource) {
            return {};
        }
        const lastDot = audioPath.lastIndexOf(".");
        if (lastDot === -1) {
            return {};
        }
        const basePath = audioPath.slice(0, lastDot);
        const paths: SidecarLyricPaths = {};
        if (lrcSource.rawLrc) {
            const lrcPath = `${basePath}.lrc`;
            await fsUtil.writeFile(lrcPath, lrcSource.rawLrc, "utf8");
            paths.lrcPath = lrcPath;
        }
        if (lrcSource.translation) {
            const tranPath = `${basePath}.tran.lrc`;
            await fsUtil.writeFile(tranPath, lrcSource.translation, "utf8");
            paths.tranLrcPath = tranPath;
        }
        return paths;
    } catch {
        return {};
    }
}

async function rimrafSidecars(paths: SidecarLyricPaths): Promise<void> {
    const files = [paths.lrcPath, paths.tranLrcPath].filter(Boolean) as string[];
    await Promise.all(files.map((fp) => fsUtil.rimraf(fp).catch(() => undefined)));
}

async function finalizeLocalDownload(
    cacheDownloadPath: string,
    targetDownloadPath: string,
    musicItem: IMusic.IMusicItem,
    realQuality: IMusic.IQualityKey,
): Promise<void> {
    await ensureDirectory(window.path.dirname(targetDownloadPath));
    await fsUtil.copyFile(cacheDownloadPath, targetDownloadPath);
    await writeSidecarLyrics(musicItem, targetDownloadPath);
    addDownloadedMusicToList(
        setInternalData<IMusic.IMusicItemInternalData>(
            musicItem,
            "downloadData",
            {
                path: targetDownloadPath,
                quality: realQuality,
            },
            true,
        ) as IMusic.IMusicItem,
    );
}

async function startDownload(
    musicItems: IMusic.IMusicItem | IMusic.IMusicItem[],
) {
    if (!downloaderWorker) {
        setupDownloaderWorker();
    }

    const _musicItems = Array.isArray(musicItems) ? musicItems : [musicItems];
    const _validMusicItems = _musicItems.filter(
        (it) => !isDownloaded(it) && it.platform !== localPluginName,
    );

    const downloadCallbacks = _validMusicItems.map((it) => {
        const pk = getMediaPrimaryKey(it);
        downloadingProgress.set(pk, {
            state: DownloadState.WAITING,
        });

        return async () => {
            if (!downloadingProgress.has(pk)) {
                return;
            }

            downloadingProgress.get(pk).state = DownloadState.DOWNLOADING;
            const fileBasename = buildDownloadBasename(it);
            await new Promise<void>((resolve) => {
                downloadMusicImpl(it, fileBasename, (stateData) => {
                    downloadingProgress.set(pk, stateData);
                    ee.emit(DownloadEvts.DownloadStatusUpdated, it, stateData);
                    if (stateData.state === DownloadState.DONE) {
                        downloadingMusicStore.setValue((prev) =>
                            prev.filter((di) => !isSameMedia(it, di)),
                        );
                        downloadingProgress.delete(pk);
                        resolve();
                    } else if (stateData.state === DownloadState.ERROR) {
                        resolve();
                    }
                });
            });
        };
    });

    downloadingMusicStore.setValue((prev) => [...prev, ..._validMusicItems]);
    downloadingQueue.addAll(downloadCallbacks);
}

async function downloadMusicImpl(
    musicItem: IMusic.IMusicItem,
    fileBasename: string,
    onStateChange: IOnStateChangeFunc,
) {
    const [defaultQuality, whenQualityMissing] = [
        AppConfig.getConfig("download.defaultQuality"),
        AppConfig.getConfig("download.whenQualityMissing"),
    ];
    const qualityOrder = getQualityOrder(defaultQuality, whenQualityMissing);
    let mediaSource: IPlugin.IMediaSourceResult | null = null;
    let realQuality: IMusic.IQualityKey = qualityOrder[0];
    for (const quality of qualityOrder) {
        try {
            mediaSource = await PluginManager.callPluginDelegateMethod(
                musicItem,
                "getMediaSource",
                musicItem,
                quality,
            );
            if (!mediaSource?.url) {
                continue;
            }
            realQuality = quality;
            break;
        } catch {}
    }

    try {
        if (!mediaSource?.url) {
            throw new Error("Invalid Source");
        }

        const ext = mediaSource.url.match(/.*\/.+\.([^./?#]+)/)?.[1] ?? "mp3";
        const audioFilename = `${fileBasename}.${ext}`;
        const downloadBasePath =
            AppConfig.getConfig("download.path") ??
            getGlobalContext().appPath.downloads;
        const useWebdav = shouldUseWebdavDownloadDestination();
        const cacheDir = window.path.resolve(downloadBasePath, ".mf-dl-cache");
        const cacheDownloadPath = window.path.resolve(cacheDir, audioFilename);

        if (!useWebdav) {
            await ensureDirectory(downloadBasePath);
        }
        await ensureDirectory(cacheDir);

        const targetDownloadPath = window.path.resolve(
            downloadBasePath,
            audioFilename,
        );

        downloaderWorker.downloadFile(
            mediaSource,
            cacheDownloadPath,
            Comlink.proxy(async (dataState) => {
                onStateChange(dataState);
                if (dataState.state !== DownloadState.DONE) {
                    return;
                }

                try {
                    if (useWebdav) {
                        const sidecars = await writeSidecarLyrics(
                            musicItem,
                            cacheDownloadPath,
                        );
                        try {
                            const uploadResult = await uploadDownloadArtifacts({
                                localAudioPath: cacheDownloadPath,
                                audioFilename,
                                localLrcPath: sidecars.lrcPath ?? null,
                                localTranLrcPath: sidecars.tranLrcPath ?? null,
                            });
                            await migrateTrackToWebdavSource(musicItem, {
                                remotePath: uploadResult.remoteAudioPath,
                                title: musicItem.title,
                                artist: musicItem.artist,
                                album: musicItem.album,
                                duration: musicItem.duration,
                            });
                            if (uploadResult.audioSkipped) {
                                toast.info(
                                    i18n.t(
                                        "settings.download.toast_webdav_audio_skipped",
                                    ),
                                );
                            }
                        } catch {
                            await finalizeLocalDownload(
                                cacheDownloadPath,
                                targetDownloadPath,
                                musicItem,
                                realQuality,
                            );
                            toast.warning(
                                i18n.t(
                                    "settings.download.toast_webdav_upload_fallback",
                                ),
                            );
                        } finally {
                            await fsUtil.rimraf(cacheDownloadPath).catch(
                                () => undefined,
                            );
                            await rimrafSidecars(sidecars);
                        }
                    } else {
                        await finalizeLocalDownload(
                            cacheDownloadPath,
                            targetDownloadPath,
                            musicItem,
                            realQuality,
                        );
                        await fsUtil.rimraf(cacheDownloadPath).catch(
                            () => undefined,
                        );
                    }
                } catch (e) {
                    onStateChange({
                        state: DownloadState.ERROR,
                        msg: e instanceof Error ? e.message : String(e),
                    });
                }
            }),
        );
    } catch (e) {
        onStateChange({
            state: DownloadState.ERROR,
            msg: e instanceof Error ? e.message : String(e),
        });
    }
}

function useDownloadStatus(musicItem: IMusic.IMusicItem) {
    const [downloadStatus, setDownloadStatus] = useState<IDownloadStatus | null>(
        null,
    );

    useEffect(() => {
        setDownloadStatus(
            downloadingProgress.get(getMediaPrimaryKey(musicItem)) || null,
        );

        const updateFn = (mi: IMusic.IMusicItem, stateData: IDownloadStatus) => {
            if (isSameMedia(mi, musicItem)) {
                setDownloadStatus(stateData);
            }
        };

        ee.on(DownloadEvts.DownloadStatusUpdated, updateFn);

        return () => {
            ee.off(DownloadEvts.DownloadStatusUpdated, updateFn);
        };
    }, [musicItem]);

    return downloadStatus;
}

function useDownloadState(musicItem: IMusic.IMusicItem) {
    const musicStatus = useDownloadStatus(musicItem);
    const downloaded = useDownloaded(musicItem);

    return (
        musicStatus?.state || (downloaded ? DownloadState.DONE : DownloadState.NONE)
    );
}

const Downloader = {
    setupDownloader,
    startDownload,
    useDownloadStatus,
    useDownloadingMusicList: downloadingMusicStore.useValue,
    useDownloaded,
    isDownloaded,
    useDownloadedMusicList,
    removeDownloadedMusic,
    setDownloadingConcurrency,
    useDownloadState,
};
export default Downloader;
