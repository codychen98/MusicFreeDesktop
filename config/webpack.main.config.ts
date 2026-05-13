import type { Configuration } from "webpack";
import path from "path";

import { getWebpackRules } from "./webpack.rules";

const nodeModules = path.join(__dirname, "../node_modules");

function nodePackageEntry(pkg: string, filePath: string): string {
    return path.join(nodeModules, pkg, filePath);
}

export const mainConfig: Configuration = {
    /**
     * This is the main entry point for your application, it's the first file
     * that runs in the main process.
     */
    entry: {
        index: ["./src/main/file-shim.ts", "./src/main/index.ts"],
    },
    // Put your normal webpack config below here
    module: {
        rules: getWebpackRules("main"),
    },
    resolve: {
        extensions: [".js", ".ts", ".jsx", ".tsx", ".css", ".json", ".node"],
        /**
         * Prefer Node entry points for packages that expose `"node"` vs `"default"` exports
         * (e.g. music-metadata, file-type, strtok3). Without `node`, webpack can resolve the
         * browser build and crash the main process with `ReferenceError: File is not defined`.
         */
        conditionNames: ["node", "electron", "..."],
        alias: {
            "@": path.join(__dirname, "../src"),
            "@main": path.join(__dirname, "../src/main"),
            "@native": path.join(__dirname, "../src/main/native_modules"),
            "@shared": path.join(__dirname, "../src/shared"),
            "music-metadata$": nodePackageEntry("music-metadata", "lib/index.js"),
            "strtok3$": nodePackageEntry("strtok3", "lib/index.js"),
            "file-type$": nodePackageEntry("file-type", "index.js"),
        },
    },
    output: {
        filename: "[name].js",
    },
    externals: ["sharp"],
};
