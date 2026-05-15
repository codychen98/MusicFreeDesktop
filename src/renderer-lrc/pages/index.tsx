import "./index.scss";
import classNames from "@/renderer/utils/classnames";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Condition from "@/renderer/components/Condition";
import SvgAsset from "@/renderer/components/SvgAsset";
import { PlayerState } from "@/common/constant";
import getTextWidth from "@/renderer/utils/get-text-width";
import useAppConfig from "@/hooks/useAppConfig";
import { appWindowUtil } from "@shared/utils/renderer";
import AppConfig from "@shared/app-config/renderer";
import messageBus, { useAppStatePartial } from "@shared/message-bus/renderer/extension";
import { IAppState } from "@shared/message-bus/type";

export default function LyricWindowPage() {
    const currentMusic = useAppStatePartial("musicItem");
    const playerState = useAppStatePartial("playerState");
    const lockLyric = useAppConfig("lyric.lockLyric");
    const [showOperations, setShowOperations] = useState(false);

    const mouseOverTimerRef = useRef<number | null>(null);

    useEffect(() => {
        if (lockLyric) {
            setShowOperations(false);
        }
    }, [lockLyric]);

    return (
        <div
            className={classNames({
                "container": true,
                "lock-lyric": lockLyric,
            })}
            onMouseOver={() => {
                if (!lockLyric || mouseOverTimerRef.current) {
                    if (!lockLyric) {
                        setShowOperations(true);
                    }
                    return;
                }
                mouseOverTimerRef.current = window.setTimeout(() => {
                    setShowOperations(true);
                    clearTimeout(mouseOverTimerRef.current);
                    mouseOverTimerRef.current = null;
                }, 1000);
            }}
            onMouseLeave={() => {
                setShowOperations(false);
                if (mouseOverTimerRef.current) {
                    clearTimeout(mouseOverTimerRef.current);
                    mouseOverTimerRef.current = null;
                }
            }}
        >
            <div className='operation-outer-container'>
                <Condition condition={showOperations}>
                    <div className="operation-container">
                        <Condition
                            condition={!lockLyric}
                            falsy={
                                <div
                                    className="operation-button"
                                    onClick={() => {
                                        AppConfig.setConfig({
                                            "lyric.lockLyric": false,
                                        });
                                    }}
                                    onMouseOver={() => {
                                        appWindowUtil.ignoreMouseEvent(false);
                                    }}
                                    onMouseLeave={() => {
                                        appWindowUtil.ignoreMouseEvent(true);
                                    }}
                                >
                                    <SvgAsset iconName="lock-open"></SvgAsset>
                                </div>
                            }
                        >
                            <div
                                className="operation-button"
                                onClick={() => {
                                    messageBus.sendCommand("SkipToPrevious");
                                }}
                            >
                                <SvgAsset iconName="skip-left"></SvgAsset>
                            </div>
                            <div
                                className="operation-button"
                                onClick={() => {
                                    if (currentMusic) {
                                        messageBus.sendCommand("TogglePlayerState");
                                    }
                                }}
                            >
                                <SvgAsset
                                    iconName={
                                        playerState === PlayerState.Playing ? "pause" : "play"
                                    }
                                ></SvgAsset>
                            </div>
                            <div
                                className="operation-button"
                                onClick={() => {
                                    messageBus.sendCommand("SkipToNext");
                                }}
                            >
                                <SvgAsset iconName="skip-right"></SvgAsset>
                            </div>
                            <div
                                className="operation-button"
                                onClick={() => {
                                    AppConfig.setConfig({
                                        "lyric.lockLyric": true,
                                    });
                                }}
                            >
                                <SvgAsset iconName="lock-closed"></SvgAsset>
                            </div>
                            <div
                                className="operation-button"
                                onClick={() => {
                                    appWindowUtil.setLyricWindow(false);
                                }}
                            >
                                <SvgAsset iconName="x-mark"></SvgAsset>
                            </div>
                        </Condition>
                    </div>
                </Condition>
            </div>
            <div className="content-container">
                <LyricContent></LyricContent>
            </div>
        </div>
    );
}

const LYRIC_CHROME_HEIGHT = 60;
const DEFAULT_LINE_COUNT = 5;

function LyricContent() {
    const currentMusic = useAppStatePartial("musicItem");
    const currentLyric = useAppStatePartial("parsedLrc");
    const fullLyric = useAppStatePartial("fullLyric");
    const fontData = useAppConfig("lyric.fontData");
    const fontSize = useAppConfig("lyric.fontSize") ?? 48;
    const fontColor = useAppConfig("lyric.fontColor");
    const strokeColor = useAppConfig("lyric.strokeColor");
    const fontFamily = fontData?.family || undefined;

    const [lineCount, setLineCount] = useState(DEFAULT_LINE_COUNT);

    useLayoutEffect(() => {
        const updateLineCount = () => {
            setLineCount(
                Math.max(1, Math.floor((window.innerHeight - LYRIC_CHROME_HEIGHT) / fontSize)),
            );
        };
        updateLineCount();
        window.addEventListener("resize", updateLineCount);
        return () => window.removeEventListener("resize", updateLineCount);
    }, [fontSize]);

    const textStyle = {
        color: fontColor,
        WebkitTextStrokeColor: strokeColor,
        fontSize,
        fontFamily,
    };

    const fallback =
        currentLyric?.lrc ??
        (currentMusic ? `${currentMusic.title} - ${currentMusic.artist}` : "暂无歌词");

    const lines = useMemo(() => {
        if (!fullLyric?.length || lineCount <= 1) {
            return [];
        }
        const idx = Math.max(0, currentLyric?.index ?? 0);
        const before = Math.floor((lineCount - 1) / 2);
        let start = Math.max(0, idx - before);
        const end = Math.min(fullLyric.length, start + lineCount);
        start = Math.max(0, end - lineCount);
        return fullLyric.slice(start, end);
    }, [fullLyric, currentLyric?.index, lineCount]);

    const [enableTransition, setEnableTransition] = useState(false);
    const [left, setLeft] = useState<number | null>(null);

    const textWidth = useMemo(() => {
        if (lineCount > 1) {
            return 0;
        }
        return getTextWidth(fallback, { fontSize, fontFamily });
    }, [lineCount, fallback, fontSize, fontFamily]);

    useLayoutEffect(() => {
        if (lineCount > 1 || textWidth <= window.innerWidth) {
            setEnableTransition(false);
            setLeft(lineCount > 1 ? null : textWidth > window.innerWidth ? 0 : null);
            return;
        }
        setEnableTransition(false);
        setLeft(0);
    }, [lineCount, textWidth]);

    useLayoutEffect(() => {
        if (lineCount > 1) {
            return;
        }
        const callback = (_: unknown, patch: IAppState) => {
            if (!patch.progress || textWidth <= window.innerWidth) {
                return;
            }
            if (currentLyric && currentLyric.index > -1 && fullLyric) {
                const nextLyric = fullLyric[currentLyric.index + 1];
                if (nextLyric && nextLyric.time > currentLyric.time) {
                    const diff = nextLyric.time - currentLyric.time;
                    const virtualPointer = ((patch.progress - currentLyric.time) / diff) * textWidth;
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
    }, [lineCount, textWidth, fullLyric, currentLyric]);

    if (lineCount <= 1) {
        return (
            <div
                className="lyric-text-row"
                style={{
                    ...textStyle,
                    left: left ?? undefined,
                    transition: enableTransition ? "left 900ms linear" : "none",
                }}
            >
                {fallback}
            </div>
        );
    }

    return (
        <div className="lyric-text-stack" style={textStyle}>
            {lines.length > 0
                ? lines.map((item) => (
                    <div
                        key={item.index}
                        className="lyric-text-row"
                        data-highlight={currentLyric?.index === item.index}
                    >
                        {item.lrc}
                    </div>
                ))
                : (
                    <div className="lyric-text-row" data-highlight>
                        {fallback}
                    </div>
                )}
        </div>
    );
}

