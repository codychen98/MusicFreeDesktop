import type { Configuration } from "webpack";
import path from "path";
import webpack from "webpack";

import { rules } from "./webpack.rules";

const nodeModules = path.join(__dirname, "../node_modules");

function nodePackageEntry(pkg: string, filePath: string): string {
  return path.join(nodeModules, pkg, filePath);
}

/** Runs before any bundled module; avoids ReferenceError from browser-only branches that touch `File`. */
const mainProcessFileShimBanner = `(function(){try{if(typeof globalThis.File==="undefined"){var B=globalThis.Blob||(typeof require!=="undefined"&&require("buffer").Blob);if(typeof B==="function"){globalThis.File=class File extends B{constructor(bits,name,opts){opts=opts??{};if(arguments.length<2)throw new TypeError("Failed to construct File");super(bits,opts);Object.defineProperty(this,"name",{value:String(name),enumerable:!0});var lm=opts.lastModified===void 0?Date.now():Number(opts.lastModified);Object.defineProperty(this,"lastModified",{value:Number.isNaN(lm)?Date.now():lm,enumerable:!0})}}}}}}catch(e){}})();`;

export const mainConfig: Configuration = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: {
    index: "./src/main/index.ts",
  },
  // Put your normal webpack config below here
  module: {
    rules,
  },
  plugins: [
    new webpack.BannerPlugin({
      banner: mainProcessFileShimBanner,
      raw: true,
      entryOnly: true,
    }),
  ],
  resolve: {
    extensions: [".js", ".ts", ".jsx", ".tsx", ".css", ".json", '.node'],
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
  externals: ['sharp']
};
