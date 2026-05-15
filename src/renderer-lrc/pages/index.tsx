import "./index.scss";
import classNames from "@/renderer/utils/classnames";
import { useEffect, useRef, useState } from "react";
import Condition from "@/renderer/components/Condition";
import SvgAsset from "@/renderer/components/SvgAsset";
import { PlayerState } from "@/common/constant";
import useAppConfig from "@/hooks/useAppConfig";
import { appWindowUtil } from "@shared/utils/renderer";
import AppConfig from "@shared/app-config/renderer";
import messageBus, { useAppStatePartial } from "@shared/message-bus/renderer/extension";
import LyricScrollView from "@/renderer-lrc/components/LyricScrollView";

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
                container: true,
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
            <div className="operation-outer-container">
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
                                    <SvgAsset iconName="lock-open" />
                                </div>
                            }
                        >
                            <div
                                className="operation-button"
                                onClick={() => {
                                    messageBus.sendCommand("SkipToPrevious");
                                }}
                            >
                                <SvgAsset iconName="skip-left" />
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
                                />
                            </div>
                            <div
                                className="operation-button"
                                onClick={() => {
                                    messageBus.sendCommand("SkipToNext");
                                }}
                            >
                                <SvgAsset iconName="skip-right" />
                            </div>
                            <div
                                className="operation-button"
                                onClick={() => {
                                    AppConfig.setConfig({
                                        "lyric.lockLyric": true,
                                    });
                                }}
                            >
                                <SvgAsset iconName="lock-closed" />
                            </div>
                            <div
                                className="operation-button"
                                onClick={() => {
                                    appWindowUtil.setLyricWindow(false);
                                }}
                            >
                                <SvgAsset iconName="x-mark" />
                            </div>
                        </Condition>
                    </div>
                </Condition>
            </div>
            <div className="content-container">
                <LyricContent />
            </div>
        </div>
    );
}

function LyricContent() {
    const fontData = useAppConfig("lyric.fontData");
    const fontSize = useAppConfig("lyric.fontSize") ?? 48;
    const fontColor = useAppConfig("lyric.fontColor");
    const strokeColor = useAppConfig("lyric.strokeColor");
    const fontFamily = fontData?.family || undefined;

    return (
        <LyricScrollView
            fontSize={fontSize}
            fontFamily={fontFamily}
            fontColor={fontColor}
            strokeColor={strokeColor}
        />
    );
}
