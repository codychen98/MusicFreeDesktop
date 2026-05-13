import type { ModuleOptions } from "webpack";

/**
 * Packages touched primarily by the main-process bundle (music-metadata chain).
 * Excluding them from @vercel/webpack-asset-relocator-loader applies only to the
 * main compiler via {@link getWebpackRules}(`"main"`), not to renderer / preload / workers.
 */
const parserChainRelocatorExclude =
    /[/\\]node_modules[/\\](?:music-metadata|strtok3|file-type|peek-readable|token-types|@tokenizer[/\\]token)[/\\]/;

export type WebpackRuleBundleTarget = "main" | "renderer";

export function getWebpackRules(bundleTarget: WebpackRuleBundleTarget): Required<ModuleOptions>["rules"] {
    const assetRelocatorRule: Required<ModuleOptions>["rules"][number] = {
        test: /[/\\]node_modules[/\\].+\.(m?js|node)$/,
        parser: { amd: false },
        use: {
            loader: "@vercel/webpack-asset-relocator-loader",
            options: {
                outputAssetBase: "native_modules",
            },
        },
    };

    if (bundleTarget === "main") {
        assetRelocatorRule.exclude = parserChainRelocatorExclude;
    }

    return [
        {
            test: /native_modules[/\\].+\.node$/,
            use: "node-loader",
        },
        assetRelocatorRule,
        {
            test: /\.tsx?$/,
            exclude: /(node_modules|\.webpack)/,
            use: {
                loader: "ts-loader",
                options: {
                    transpileOnly: true,
                },
            },
        },
        {
            test: /\.jsx?$/,
            use: {
                loader: "babel-loader",
                options: {
                    exclude: /node_modules/,
                    presets: ["@babel/preset-react"],
                },
            },
        },
    ];
}

/** Renderer, preload, and web workers (Forge uses renderer webpack.config rules). */
export const rules = getWebpackRules("renderer");
