/** Smooth scroll; returns cancel function (LX desktop-lyric pattern). */
export function animateScrollTop(
    element: HTMLElement,
    targetTop: number,
    duration: number,
): () => void {
    const startTop = element.scrollTop;
    const delta = targetTop - startTop;

    if (duration <= 0 || delta === 0) {
        element.scrollTop = targetTop;
        return () => undefined;
    }

    const startTime = performance.now();
    let frameId = 0;

    const step = (now: number) => {
        const progress = Math.min((now - startTime) / duration, 1);
        element.scrollTop = startTop + delta * progress;
        if (progress < 1) {
            frameId = requestAnimationFrame(step);
        }
    };

    frameId = requestAnimationFrame(step);

    return () => {
        cancelAnimationFrame(frameId);
    };
}

export function getScrollTopForCenteredLine(
    containerHeight: number,
    lineOffsetTop: number,
    lineHeight: number,
): number {
    const centerOffset = containerHeight * 0.5 - lineHeight / 2;
    return Math.max(0, lineOffsetTop - centerOffset);
}
