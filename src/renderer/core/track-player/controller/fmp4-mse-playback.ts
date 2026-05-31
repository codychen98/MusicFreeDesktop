import MP4Box, {
    type Mp4BoxReadyInfo,
    type Mp4BoxTrackInfo,
} from "mp4box";

export interface Fmp4PlaybackHandle {
    revoke: () => void;
}

function appendSourceBuffer(
    sourceBuffer: SourceBuffer,
    buffer: ArrayBuffer,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const runAppend = () => {
            try {
                sourceBuffer.appendBuffer(buffer);
            } catch (e) {
                reject(e);
                return;
            }
            const onUpdateEnd = () => {
                sourceBuffer.removeEventListener("updateend", onUpdateEnd);
                resolve();
            };
            sourceBuffer.addEventListener("updateend", onUpdateEnd);
        };

        if (sourceBuffer.updating) {
            sourceBuffer.addEventListener("updateend", () => runAppend(), {
                once: true,
            });
        } else {
            runAppend();
        }
    });
}

function pickAudioTrack(tracks: Mp4BoxTrackInfo[]): Mp4BoxTrackInfo | null {
    return (
        tracks.find((t) => t.audio) ??
        tracks.find((t) => t.type === "audio") ??
        tracks[0] ??
        null
    );
}

function buildAudioMimeCodec(track: Mp4BoxTrackInfo): string {
    const codec = track.codec ?? "mp4a.40.2";
    return `audio/mp4; codecs="${codec}"`;
}

function setupMp4BoxPlayback(
    mp4boxfile: ReturnType<typeof MP4Box.createFile>,
    mediaSource: MediaSource,
    info: Mp4BoxReadyInfo,
    fail: (error: Error) => void,
    resolve: (handle: Fmp4PlaybackHandle) => void,
    isRevoked: () => boolean,
): void {
    let sourceBuffer: SourceBuffer | null = null;

    const audioTrack = pickAudioTrack(info.tracks);
    if (!audioTrack) {
        fail(new Error("No audio track in file"));
        return;
    }

    const mime = buildAudioMimeCodec(audioTrack);
    if (!MediaSource.isTypeSupported(mime)) {
        fail(new Error(`Unsupported codec: ${mime}`));
        return;
    }

    sourceBuffer = mediaSource.addSourceBuffer(mime);

    mp4boxfile.onSegment = (
        _id: number,
        _user: unknown,
        buffer: ArrayBuffer,
        _sampleNumber: number,
        last: boolean,
    ) => {
        if (isRevoked() || !sourceBuffer) {
            return;
        }
        void appendSourceBuffer(sourceBuffer, buffer)
            .then(() => {
                if (
                    last &&
                    !isRevoked() &&
                    mediaSource.readyState === "open"
                ) {
                    try {
                        mediaSource.endOfStream();
                    } catch {
                        // ignore
                    }
                }
            })
            .catch(fail);
    };

    mp4boxfile.setSegmentOptions(audioTrack.id, sourceBuffer, {
        nbSamples: 1_000_000,
    });

    const initSegs = mp4boxfile.initializeSegmentation();

    void (async () => {
        try {
            for (const seg of initSegs) {
                if (isRevoked() || !sourceBuffer) {
                    return;
                }
                await appendSourceBuffer(sourceBuffer, seg.buffer);
            }
            mp4boxfile.start();
            resolve({
                revoke: () => {
                    try {
                        mp4boxfile.stop();
                    } catch {
                        // ignore
                    }
                },
            });
        } catch (e) {
            fail(e as Error);
        }
    })();
}

/**
 * Feed a fetched fMP4 / .m4s buffer through MSE (same class of files ExoPlayer plays on Android).
 */
export async function attachFetchedFmp4ToAudio(
    audio: HTMLAudioElement,
    arrayBuffer: ArrayBuffer,
): Promise<Fmp4PlaybackHandle> {
    if (typeof MediaSource === "undefined") {
        throw new Error("MediaSource not supported");
    }

    const mp4boxfile = MP4Box.createFile();
    const mediaSource = new MediaSource();
    const mediaObjectUrl = URL.createObjectURL(mediaSource);
    audio.src = mediaObjectUrl;

    let revoked = false;
    let pendingReady: Mp4BoxReadyInfo | null = null;
    let sourceOpen = false;
    let outerResolve: ((handle: Fmp4PlaybackHandle) => void) | null = null;
    let outerReject: ((error: Error) => void) | null = null;

    const revoke = () => {
        if (revoked) {
            return;
        }
        revoked = true;
        try {
            mp4boxfile.stop();
        } catch {
            // ignore
        }
        URL.revokeObjectURL(mediaObjectUrl);
        try {
            if (mediaSource.readyState === "open") {
                mediaSource.endOfStream();
            }
        } catch {
            // ignore
        }
    };

    const fail = (error: Error) => {
        revoke();
        outerReject?.(error);
    };

    const tryStartPlayback = () => {
        if (revoked || !pendingReady || !sourceOpen || !outerResolve) {
            return;
        }
        setupMp4BoxPlayback(
            mp4boxfile,
            mediaSource,
            pendingReady,
            fail,
            (handle) => {
                outerResolve?.({
                    revoke: () => {
                        handle.revoke();
                        revoke();
                    },
                });
            },
            () => revoked,
        );
    };

    return new Promise((resolve, reject) => {
        outerResolve = resolve;
        outerReject = reject;

        mp4boxfile.onError = (message: string) => {
            fail(new Error(message));
        };

        mp4boxfile.onReady = (info: Mp4BoxReadyInfo) => {
            if (revoked) {
                return;
            }
            pendingReady = info;
            tryStartPlayback();
        };

        mediaSource.addEventListener(
            "sourceopen",
            () => {
                if (revoked) {
                    return;
                }
                sourceOpen = true;
                tryStartPlayback();
            },
            { once: true },
        );

        const mp4Buffer = arrayBuffer as ArrayBuffer & { fileStart: number };
        mp4Buffer.fileStart = 0;
        mp4boxfile.appendBuffer(mp4Buffer);
        mp4boxfile.flush();
    });
}
