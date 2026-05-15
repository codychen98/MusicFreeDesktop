import { useEffect, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import checkUpdate from "../utils/check-update";
import Themepack from "@/shared/themepack/renderer";
import logger from "@shared/logger/renderer";
import AppConfig from "@shared/app-config/renderer";
import messageBus from "@shared/message-bus/renderer/main";
import { runWebdavBootstrapSync } from "@/renderer/core/webdav-sync";

let webdavBootstrapSyncStarted = false;

export default function useBootstrap() {
    const navigate = useNavigate();

    useLayoutEffect(() => {
        Themepack.setupThemePacks();
    }, []);

    useEffect(() => {
        messageBus.onCommand("Navigate", (route) => {
            navigate(route);
        });

        if (AppConfig.getConfig("normal.checkUpdate")) {
            checkUpdate();
        }
        logger.logPerf("Bundle First Screen");

        if (!webdavBootstrapSyncStarted) {
            webdavBootstrapSyncStarted = true;
            void runWebdavBootstrapSync();
        }
    }, []);
}
