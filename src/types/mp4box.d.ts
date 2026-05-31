declare module "mp4box" {
    export interface Mp4BoxTrackInfo {
        id: number;
        codec?: string;
        audio?: boolean;
        type?: string;
    }

    export interface Mp4BoxReadyInfo {
        tracks: Mp4BoxTrackInfo[];
    }

    export interface Mp4BoxInitSegment {
        id: number;
        buffer: ArrayBuffer;
    }

    export interface Mp4BoxFile {
        onReady: ((info: Mp4BoxReadyInfo) => void) | null;
        onSegment:
            | ((
                  id: number,
                  user: unknown,
                  buffer: ArrayBuffer,
                  sampleNumber: number,
                  last: boolean,
              ) => void)
            | null;
        onError: ((message: string) => void) | null;
        setSegmentOptions(
            trackId: number,
            user: unknown,
            options: { nbSamples?: number },
        ): void;
        initializeSegmentation(): Mp4BoxInitSegment[];
        start(): void;
        stop(): void;
        appendBuffer(buffer: ArrayBuffer & { fileStart?: number }): void;
        flush(): void;
    }

    interface Mp4BoxStatic {
        createFile(): Mp4BoxFile;
    }

    const MP4Box: Mp4BoxStatic;
    export default MP4Box;
}
