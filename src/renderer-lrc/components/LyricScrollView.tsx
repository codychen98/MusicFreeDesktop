import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PlayerState } from "@/common/constant";
import getTextWidth from "@/renderer/utils/get-text-width";
import type { IParsedLrcItem } from "@/renderer/utils/lyric-parser";
import messageBus, { useAppStatePartial } from "@shared/message-bus/renderer/extension";
import type { IAppState } from "@shared/message-bus/type";
import {
    animateScrollTop,
    getScrollTopForCenteredLine,
} from "@/renderer-lrc/utils/scroll-to";

const LYRIC_CHROME_HEIGHT = 60;
const MANUAL_SCROLL_RESUME_MS = 3000;
const SCROLL_DURATION_MS = 320;

interface LyricScrollViewProps {
    fontSize: number;
    fontFamily?: string;
    fontColor?: string;
    strokeColor?: string;
}

function useCompactMode(fontSize: number) {
    const [compact, setCompact] = useState(false);

    useLayoutEffect(() => {
        const update = () => {
            const contentHeight = window.innerHeight - LYRIC_CHROME_HEIGHT;
            setCompact(contentHeight < fontSize * 1.85);
        };
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, [fontSize]);

    return compact;
}

function LyricCompactRow({
    text,
    fontSize,
    fontFamily,
    fontColor,
    strokeColor,
}: {
    text: string;
    fontSize: number;
    fontFamily?: string;
    fontColor?: string;
    strokeColor?: string;
}) {
    const textStyle = {
        color: fontColor,
        WebkitTextStroke: strokeColor ? `1px ${strokeColor}` : undefined,
        fontSize,
        fontFamily,
    };

    const textWidth = useMemo(
        () => getTextWidth(text, { fontSize, fontFamily }),
        [text, fontSize, fontFamily],
    );

    const [enableTransition, setEnableTransition] = useState(false);
    const [left, setLeft] = useState<number | null>(null);
    const currentLyric = useAppStatePartial("parsedLrc");
    const fullLyric = useAppStatePartial("fullLyric");

    useLayoutEffect(() => {
        if (textWidth <= window.innerWidth) {
            setEnableTransition(false);
            setLeft(null);
            return;
        }
        setEnableTransition(false);
        setLeft(0);
    }, [textWidth]);

    useLayoutEffect(() => {
        const callback = (_: unknown, patch: IAppState) => {
            if (!patch.progress || textWidth <= window.innerWidth) {
                return;
            }
            if (currentLyric && currentLyric.index > -1 && fullLyric) {
                const nextLyric = fullLyric[currentLyric.index + 1];
                if (nextLyric && nextLyric.time > currentLyric.time) {
                    const diff = nextLyric.time - currentLyric.time;
                    const virtualPointer =
                        ((patch.progress - currentLyric.time) / diff) * textWidth;
                    if (virtualPointer > window.innerWidth * 0.5) {
                        setEnableTransition(true);
                        setLeft(
                            -Math.min(
                                (virtualPointer - window.innerWidth * 0.5) * 1.1,
                                textWidth - window.innerWidth,
                            ),
                        );
                        return;
                    }
                }
            }
            setEnableTransition(false);
            setLeft(0);
        };
        messageBus.onStateChange(callback);
        return () => messageBus.offStateChange(callback);
    }, [textWidth, fullLyric, currentLyric]);

    return (
        <div className="lyric-compact-view">
            <div
                className="lyric-text-row"
                style={{
                    ...textStyle,
                    left: left ?? undefined,
                    transition: enableTransition ? "left 900ms linear" : "none",
                }}
            >
                {text}
            </div>
        </div>
    );
}

export default function LyricScrollView({
    fontSize,
    fontFamily,
    fontColor,
    strokeColor,
}: LyricScrollViewProps) {
    const currentMusic = useAppStatePartial("musicItem");
    const currentLyric = useAppStatePartial("parsedLrc");
    const fullLyric = useAppStatePartial("fullLyric");
    const playerState = useAppStatePartial("playerState");

    const compact = useCompactMode(fontSize);

    const scrollRef = useRef<HTMLDivElement>(null);
    const cancelScrollRef = useRef<(() => void) | null>(null);
    const manualScrollTimeoutRef = useRef<number | null>(null);
    const isManualScrollRef = useRef(false);
    const dragRef = useRef({ active: false, startY: 0, startScrollTop: 0 });
    const prevLineCountRef = useRef(0);

    const [spacerHeight, setSpacerHeight] = useState(0);

    const textStyle = useMemo(
        () => ({
            color: fontColor,
            WebkitTextStroke: strokeColor ? `1px ${strokeColor}` : undefined,
            fontSize,
            fontFamily,
            "--lyric-line-gap": `${Math.max(4, Math.round(fontSize * 0.18))}px`,
        }),
        [fontColor, strokeColor, fontSize, fontFamily],
    );

    const fallback =
        currentLyric?.lrc ??
        (currentMusic ? `${currentMusic.title} - ${currentMusic.artist}` : "暂无歌词");

    const activeIndex = Math.max(0, currentLyric?.index ?? 0);
    const lines: IParsedLrcItem[] = fullLyric?.length ? fullLyric : [];

    const updateSpacerHeight = useCallback(() => {
        const container = scrollRef.current;
        if (!container) {
            return;
        }
        const half = container.clientHeight / 2 - fontSize * 0.55;
        setSpacerHeight(Math.max(0, half));
    }, [fontSize]);

    const scrollToActiveLine = useCallback(
        (duration = SCROLL_DURATION_MS) => {
            if (isManualScrollRef.current || compact) {
                return;
            }
            const container = scrollRef.current;
            if (!container || !lines.length) {
                return;
            }

            const lineEl = container.querySelector<HTMLElement>(
                `[data-lyric-index="${activeIndex}"]`,
            );
            if (!lineEl) {
                return;
            }

            const targetTop = getScrollTopForCenteredLine(
                container.clientHeight,
                lineEl.offsetTop,
                lineEl.offsetHeight,
            );

            cancelScrollRef.current?.();
            cancelScrollRef.current = animateScrollTop(container, targetTop, duration);
        },
        [activeIndex, compact, lines.length],
    );

    const pauseAutoScroll = useCallback(() => {
        isManualScrollRef.current = true;
        cancelScrollRef.current?.();
        cancelScrollRef.current = null;

        if (manualScrollTimeoutRef.current !== null) {
            window.clearTimeout(manualScrollTimeoutRef.current);
        }
        manualScrollTimeoutRef.current = window.setTimeout(() => {
            manualScrollTimeoutRef.current = null;
            isManualScrollRef.current = false;
            if (playerState === PlayerState.Playing) {
                scrollToActiveLine();
            }
        }, MANUAL_SCROLL_RESUME_MS);
    }, [playerState, scrollToActiveLine]);

    useLayoutEffect(() => {
        updateSpacerHeight();
        window.addEventListener("resize", updateSpacerHeight);
        return () => window.removeEventListener("resize", updateSpacerHeight);
    }, [updateSpacerHeight, compact]);

    useLayoutEffect(() => {
        if (compact) {
            return;
        }
        const frame = requestAnimationFrame(() => {
            updateSpacerHeight();
            const isNewSong = lines.length !== prevLineCountRef.current;
            prevLineCountRef.current = lines.length;
            scrollToActiveLine(isNewSong ? 0 : SCROLL_DURATION_MS);
        });
        return () => cancelAnimationFrame(frame);
    }, [compact, lines.length, activeIndex, scrollToActiveLine, updateSpacerHeight]);

    useEffect(() => {
        return () => {
            cancelScrollRef.current?.();
            if (manualScrollTimeoutRef.current !== null) {
                window.clearTimeout(manualScrollTimeoutRef.current);
            }
        };
    }, []);

    const handleWheel = (event: React.WheelEvent) => {
        const container = scrollRef.current;
        if (!container) {
            return;
        }
        container.scrollTop += event.deltaY;
        pauseAutoScroll();
    };

    const handlePointerDown = (event: React.PointerEvent) => {
        const target = event.target as HTMLElement;
        if (!target.closest(".lyric-text-row")) {
            return;
        }
        const container = scrollRef.current;
        if (!container) {
            return;
        }
        dragRef.current = {
            active: true,
            startY: event.clientY,
            startScrollTop: container.scrollTop,
        };
        container.setPointerCapture(event.pointerId);
        pauseAutoScroll();
    };

    const handlePointerMove = (event: React.PointerEvent) => {
        if (!dragRef.current.active) {
            return;
        }
        const container = scrollRef.current;
        if (!container) {
            return;
        }
        container.scrollTop =
            dragRef.current.startScrollTop + (dragRef.current.startY - event.clientY);
    };

    const handlePointerUp = (event: React.PointerEvent) => {
        if (!dragRef.current.active) {
            return;
        }
        dragRef.current.active = false;
        scrollRef.current?.releasePointerCapture(event.pointerId);
    };

    if (compact) {
        return (
            <LyricCompactRow
                text={fallback}
                fontSize={fontSize}
                fontFamily={fontFamily}
                fontColor={fontColor}
                strokeColor={strokeColor}
            />
        );
    }

    return (
        <div
            ref={scrollRef}
            className="lyric-scroll-view"
            style={textStyle as React.CSSProperties}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            <div className="lyric-scroll-inner">
                <div
                    className="lyric-scroll-spacer"
                    style={{ height: spacerHeight }}
                    aria-hidden
                />
                {lines.length > 0 ? (
                    lines.map((item) => (
                        <div
                            key={item.index}
                            className="lyric-text-row"
                            data-lyric-index={item.index}
                            data-highlight={activeIndex === item.index}
                        >
                            {item.lrc}
                        </div>
                    ))
                ) : (
                    <div className="lyric-text-row" data-highlight>
                        {fallback}
                    </div>
                )}
                <div
                    className="lyric-scroll-spacer"
                    style={{ height: spacerHeight }}
                    aria-hidden
                />
            </div>
        </div>
    );
}
