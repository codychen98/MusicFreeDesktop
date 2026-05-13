import ReactDOM from "react-dom/client";
import App from "../app";
import "animate.css";
import ModalComponent from "../components/Modal";
import bootstrap from "./bootstrap";
import { HashRouter, Route, Routes } from "react-router-dom";
import MainPage from "../pages/main-page";
import { ContextMenuComponent } from "../components/ContextMenu";
import { ToastContainer } from "react-toastify";

import "rc-slider/assets/index.css";
import "react-toastify/dist/ReactToastify.css";
import "./styles/index.scss"; // 全局样式
import { toastDuration } from "@/common/constant";
import useBootstrap from "./useBootstrap";
import logger from "@shared/logger/renderer";
import { ErrorBoundary } from "react-error-boundary";
import Fallback from "@renderer/document/fallback";
import AppConfig from "@shared/app-config/renderer";
import trackPlayer from "../core/track-player";

logger.logPerf("Create Bundle");

const rootEl = document.getElementById("root");
if (!rootEl) {
    throw new Error("Missing #root element");
}
const root = ReactDOM.createRoot(rootEl);

function BootstrapFailure(props: { error: unknown }) {
    const err = props.error;
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : "";
    return (
        <div
            style={{
                padding: 24,
                color: "#b00020",
                fontFamily: "system-ui, sans-serif",
                whiteSpace: "pre-wrap",
            }}
        >
            <strong>Bootstrap failed</strong>
            {"\n\n"}
            {message}
            {stack ? `\n\n${stack}` : ""}
        </div>
    );
}

root.render(
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        Starting MusicFree…
    </div>,
);

bootstrap()
    .then(() => {
        logger.logPerf("Bundle Bootstrap Ready");
        root.render(
            <ErrorBoundary
                FallbackComponent={Fallback}
                onReset={() => {
                    AppConfig.reset();
                    trackPlayer.reset();
                }}
            >
                <Root></Root>
            </ErrorBoundary>,
        );
    })
    .catch((error: unknown) => {
        root.render(<BootstrapFailure error={error} />);
    });

function Root() {
    return (
        <>
            <HashRouter>
                <BootstrapComponent></BootstrapComponent>
                <Routes>
                    <Route path="/" element={<App></App>}>
                        <Route path="main/*" element={<MainPage></MainPage>}></Route>
                        <Route path="*" element={<MainPage></MainPage>}></Route>
                    </Route>
                </Routes>
                <ModalComponent></ModalComponent>
            </HashRouter>
            <ContextMenuComponent></ContextMenuComponent>
            <ToastContainer
                draggable={false}
                closeOnClick={false}
                limit={5}
                pauseOnFocusLoss={false}
                hideProgressBar
                autoClose={toastDuration.short}
                newestOnTop
            ></ToastContainer>
        </>
    );
}

function BootstrapComponent(): null {
    useBootstrap();

    return null;
}
