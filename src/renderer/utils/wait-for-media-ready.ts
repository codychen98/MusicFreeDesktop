const DEFAULT_TIMEOUT_MS = 120_000;

export function waitForMediaReady(
    audio: HTMLAudioElement,
    signal?: AbortSignal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<void> {
    if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const cleanup = () => {
            clearTimeout(timer);
            audio.removeEventListener("canplay", onCanPlay);
            audio.removeEventListener("loadeddata", onCanPlay);
            audio.removeEventListener("error", onError);
            signal?.removeEventListener("abort", onAbort);
        };

        const onCanPlay = () => {
            cleanup();
            resolve();
        };

        const onError = () => {
            cleanup();
            reject(new Error("Audio element failed to load media"));
        };

        const onAbort = () => {
            cleanup();
            reject(new DOMException("Aborted", "AbortError"));
        };

        const timer = window.setTimeout(() => {
            cleanup();
            reject(new Error("Timed out waiting for media to become playable"));
        }, timeoutMs);

        audio.addEventListener("canplay", onCanPlay);
        audio.addEventListener("loadeddata", onCanPlay);
        audio.addEventListener("error", onError);
        signal?.addEventListener("abort", onAbort, { once: true });
    });
}
