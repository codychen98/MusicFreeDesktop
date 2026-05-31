/**
 * 播放音乐
 */
import { encodeUrlHeaders } from "@/common/normalize-util";
import albumImg from "@/assets/imgs/album-cover.jpg";
import getUrlExt from "@/renderer/utils/get-url-ext";
import needsFetchedFmp4Playback from "@/renderer/utils/needs-fetched-fmp4-playback";
import {
    attachFetchedFmp4ToAudio,
    Fmp4PlaybackHandle,
} from "@/renderer/core/track-player/controller/fmp4-mse-playback";
import Hls, { Events as HlsEvents, HlsConfig } from "hls.js";
import { isSameMedia } from "@/common/media-util";
import { PlayerState } from "@/common/constant";
import ServiceManager from "@shared/service-manager/renderer";
import ControllerBase from "@renderer/core/track-player/controller/controller-base";
import { ErrorReason } from "@renderer/core/track-player/enum";
import voidCallback from "@/common/void-callback";
import { IAudioController } from "@/types/audio-controller";
import { waitForMediaReady } from "@/renderer/utils/wait-for-media-ready";

class AudioController extends ControllerBase implements IAudioController {
    private audio: HTMLAudioElement;
    private hls: Hls;
    private blobObjectUrl: string | null = null;
    private fmp4PlaybackHandle: Fmp4PlaybackHandle | null = null;
    private fetchAbort: AbortController | null = null;

    private _playerState: PlayerState = PlayerState.None;
    get playerState() {
        return this._playerState;
    }
    set playerState(value: PlayerState) {
        if (this._playerState !== value) {
            this.onPlayerStateChanged?.(value);
        }
        this._playerState = value;

    }

    public musicItem: IMusic.IMusicItem | null = null;

    get hasSource() {
        return !!this.audio.src;
    }

    constructor() {
        super();
        this.audio = new Audio();
        this.audio.preload = "auto";
        this.audio.controls = false;

        ////// events
        this.audio.onplaying = () => {
            this.playerState = PlayerState.Playing;
            navigator.mediaSession.playbackState = "playing";
        };

        this.audio.onpause = () => {
            this.playerState = PlayerState.Paused;
            navigator.mediaSession.playbackState = "paused";
        };

        this.audio.onerror = (event) => {
            this.playerState = PlayerState.Paused;
            navigator.mediaSession.playbackState = "paused";
            this.onError?.(ErrorReason.EmptyResource, event as any);
        };

        this.audio.ontimeupdate = () => {
            this.onProgressUpdate?.({
                currentTime: this.audio.currentTime,
                duration: this.audio.duration, // 缓冲中是Infinity
            });
        };

        // this.audio.onseeking = () => {
        //     this.playerState = PlayerState.Buffering;
        // }
        //
        // this.audio.onseeked = () => {
        //     this.playerState = PlayerState.Playing;
        // }

        this.audio.onended = () => {
            this.playerState = PlayerState.Paused;
            this.onEnded?.();
        };

        this.audio.onvolumechange = () => {
            this.onVolumeChange?.(this.audio.volume);
        };

        this.audio.onratechange = () => {
            this.onSpeedChange?.(this.audio.playbackRate);
        };


        // @ts-ignore  isDev
        window.ad = this.audio;
    }

    private initHls(config?: Partial<HlsConfig>) {
        if (!this.hls) {
            this.hls = new Hls(config);
            this.hls.attachMedia(this.audio);
            this.hls.on(HlsEvents.ERROR, (evt, error) => {
                this.onError(ErrorReason.EmptyResource, error);
            });
        }
    }

    private destroyHls() {
        if (this.hls) {
            this.hls.detachMedia();
            this.hls.off(HlsEvents.ERROR);
            this.hls.destroy();
            this.hls = null;
        }
    }

    private abortPendingFetch(): void {
        this.fetchAbort?.abort();
        this.fetchAbort = null;
    }

    private revokeBlobObjectUrl(): void {
        if (this.blobObjectUrl) {
            URL.revokeObjectURL(this.blobObjectUrl);
            this.blobObjectUrl = null;
        }
    }

    private revokeFmp4Playback(): void {
        this.fmp4PlaybackHandle?.revoke();
        this.fmp4PlaybackHandle = null;
    }

    private revokeDetachedPlayback(): void {
        this.revokeFmp4Playback();
        this.revokeBlobObjectUrl();
    }

    private async tryAttachBlobPlayback(
        buffer: ArrayBuffer,
        musicItem: IMusic.IMusicItem,
        signal: AbortSignal,
    ): Promise<boolean> {
        this.revokeDetachedPlayback();
        const blob = new Blob([buffer], { type: "audio/mp4" });
        this.blobObjectUrl = URL.createObjectURL(blob);
        this.audio.src = this.blobObjectUrl;

        try {
            await waitForMediaReady(this.audio, signal);
            return isSameMedia(this.musicItem, musicItem);
        } catch {
            this.revokeBlobObjectUrl();
            this.audio.removeAttribute("src");
            return false;
        }
    }

    private async setSourceFromFetchedFmp4(
        url: string,
        trackSource: IMusic.IMusicSource,
        musicItem: IMusic.IMusicItem,
    ): Promise<void> {
        this.destroyHls();
        this.abortPendingFetch();
        this.revokeDetachedPlayback();

        const abort = new AbortController();
        this.fetchAbort = abort;

        try {
            const init: RequestInit = {
                method: "GET",
                signal: abort.signal,
            };
            if (trackSource.headers) {
                init.headers = { ...trackSource.headers };
            }

            const res = await fetch(url, init);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const buffer = await res.arrayBuffer();
            if (abort.signal.aborted || !isSameMedia(this.musicItem, musicItem)) {
                return;
            }

            if (await this.tryAttachBlobPlayback(buffer, musicItem, abort.signal)) {
                return;
            }

            this.fmp4PlaybackHandle = await attachFetchedFmp4ToAudio(
                this.audio,
                buffer,
            );
            await waitForMediaReady(this.audio, abort.signal);
        } catch (e) {
            if (abort.signal.aborted) {
                return;
            }
            this.onError?.(ErrorReason.EmptyResource, e as Error);
            throw e;
        } finally {
            if (this.fetchAbort === abort) {
                this.fetchAbort = null;
            }
        }
    }

    private async setSourceFromFetchedBlob(
        url: string,
        trackSource: IMusic.IMusicSource,
        musicItem: IMusic.IMusicItem,
    ): Promise<void> {
        this.destroyHls();
        this.abortPendingFetch();
        this.revokeDetachedPlayback();

        const abort = new AbortController();
        this.fetchAbort = abort;

        try {
            const res = await fetch(url, {
                method: "GET",
                headers: {
                    ...trackSource.headers,
                },
                signal: abort.signal,
            });
            const blob = await res.blob();
            if (abort.signal.aborted || !isSameMedia(this.musicItem, musicItem)) {
                return;
            }
            this.revokeDetachedPlayback();
            this.blobObjectUrl = URL.createObjectURL(blob);
            this.audio.src = this.blobObjectUrl;
            await waitForMediaReady(this.audio, abort.signal);
        } catch (e) {
            if (abort.signal.aborted) {
                return;
            }
            this.onError?.(ErrorReason.EmptyResource, e as Error);
            throw e;
        } finally {
            if (this.fetchAbort === abort) {
                this.fetchAbort = null;
            }
        }
    }

    destroy(): void {
        this.destroyHls();
        this.abortPendingFetch();
        this.revokeDetachedPlayback();
        this.reset();
    }

    pause(): void {
        if (this.hasSource) {
            this.audio.pause();
        }
    }

    play(): void {
        if (this.hasSource) {
            this.audio.play().catch(voidCallback);
        }
    }

    reset(): void {
        this.abortPendingFetch();
        this.revokeDetachedPlayback();
        this.playerState = PlayerState.None;
        this.audio.src = "";
        this.audio.removeAttribute("src");
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = "none";
    }

    seekTo(seconds: number): void {
        if (this.hasSource && isFinite(seconds)) {
            const duration = this.audio.duration;
            this.audio.currentTime = Math.min(
                seconds,
                isNaN(duration) ? Infinity : duration,
            );
        }
    }

    setLoop(isLoop: boolean): void {
        this.audio.loop = isLoop;
    }

    setSinkId(deviceId: string): Promise<void> {
        return (this.audio as any).setSinkId(deviceId);
    }

    setSpeed(speed: number): void {
        this.audio.defaultPlaybackRate = speed;
        this.audio.playbackRate = speed;
    }

    prepareTrack(musicItem: IMusic.IMusicItem) {
        this.musicItem = { ...musicItem };

        // 1. update metadata
        navigator.mediaSession.metadata = new MediaMetadata({
            title: musicItem.title,
            artist: musicItem.artist,
            album: musicItem.album,
            artwork: [
                {
                    src: musicItem.artwork ?? albumImg,
                },
            ],
        });

        // 2. reset track
        this.abortPendingFetch();
        this.revokeDetachedPlayback();
        this.playerState = PlayerState.None;
        this.audio.src = "";
        this.audio.removeAttribute("src");
        navigator.mediaSession.playbackState = "none";
    }

    setTrackSource(
        trackSource: IMusic.IMusicSource,
        musicItem: IMusic.IMusicItem,
    ): Promise<void> {
        this.musicItem = { ...musicItem };

        // 1. update metadata
        navigator.mediaSession.metadata = new MediaMetadata({
            title: musicItem.title,
            artist: musicItem.artist,
            album: musicItem.album,
            artwork: [
                {
                    src: musicItem.artwork ?? albumImg,
                },
            ],
        });


        // 2. convert url and headers
        let url = trackSource.url;
        const urlObj = new URL(trackSource.url);
        let headers: Record<string, any> | null = null;

        // 2.1 convert user agent
        if (trackSource.headers || trackSource.userAgent) {
            headers = { ...(trackSource.headers ?? {}) };
            if (trackSource.userAgent) {
                headers["user-agent"] = trackSource.userAgent;
            }
        }

        // 2.2 convert auth header
        if (urlObj.username && urlObj.password) {
            const authHeader = `Basic ${btoa(
                `${decodeURIComponent(urlObj.username)}:${decodeURIComponent(
                    urlObj.password,
                )}`,
            )}`;
            urlObj.username = "";
            urlObj.password = "";
            headers = {
                ...(headers || {}),
                Authorization: authHeader,
            };
            url = urlObj.toString();
        }

        // 2.3 hack url with headers
        if (headers) {
            const forwardedUrl = ServiceManager.RequestForwarderService.forwardRequest(url, "GET", headers);
            if (forwardedUrl) {
                url = forwardedUrl;
                headers = null;
            } else if (!headers["Authorization"]) {
                url = encodeUrlHeaders(url, headers);
                headers = null;
            }
        }

        if (!url) {
            this.onError(ErrorReason.EmptyResource, new Error("url is empty"));
            return Promise.reject(new Error("url is empty"));
        }

        // 3. set real source
        if (getUrlExt(trackSource.url) === ".m3u8") {
            this.revokeDetachedPlayback();
            if (Hls.isSupported()) {
                this.initHls();
                this.hls.loadSource(url);
                return Promise.resolve();
            }
            this.onError(ErrorReason.UnsupportedResource);
            return Promise.reject(new Error("HLS is not supported"));
        }

        if (needsFetchedFmp4Playback(trackSource.url, musicItem)) {
            return this.setSourceFromFetchedFmp4(url, trackSource, musicItem);
        }

        if (headers) {
            return this.setSourceFromFetchedBlob(url, trackSource, musicItem);
        }

        this.destroyHls();
        this.abortPendingFetch();
        this.revokeDetachedPlayback();
        this.audio.src = url;
        return waitForMediaReady(this.audio).catch((e) => {
            this.onError?.(ErrorReason.EmptyResource, e as Error);
            throw e;
        });
    }

    setVolume(volume: number): void {
        this.audio.volume = volume;
    }
}

export default AudioController;
