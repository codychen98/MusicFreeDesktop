import { Blob as NodeBlob } from "buffer";

/**
 * Electron main runs in Node; some bundled deps assume the DOM `File` global exists.
 * Define it early so later modules do not throw ReferenceError at load time.
 */
void ((): void => {
    const g = globalThis as typeof globalThis & {
        File?: typeof File;
        Blob?: typeof Blob;
    };

    if (typeof g.File !== "undefined") {
        return;
    }

    const Base = g.Blob ?? NodeBlob;
    if (typeof Base !== "function") {
        return;
    }

    type Bits = ConstructorParameters<typeof Blob>[0];
    type Options = { lastModified?: number } & Record<string, unknown>;

    class ShimFile extends Base {
        declare name: string;

        declare lastModified: number;

        constructor(bits: Bits, fileName: string, options?: Options) {
            const opts = options ?? {};
            super(bits, opts);
            Object.defineProperty(this, "name", {
                value: String(fileName),
                enumerable: true,
            });
            const lm =
                opts.lastModified === undefined
                    ? Date.now()
                    : Number(opts.lastModified);
            Object.defineProperty(this, "lastModified", {
                value: Number.isNaN(lm) ? Date.now() : lm,
                enumerable: true,
            });
        }
    }

    g.File = ShimFile as unknown as typeof File;
})();
