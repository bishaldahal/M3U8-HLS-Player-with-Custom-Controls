export type Listener = (...args: unknown[]) => void;

/** Subset of the hls.js / dash.js instance APIs exposed by `<hls-video>` / `<dash-video>`. */
export interface EngineApi {
  on?(event: string, listener: Listener): void;
  once?(event: string, listener: Listener): void;
  off?(event: string, listener: Listener): void;
  setProtectionData?(data: Record<string, unknown>): void;
  attachSource?(url: string): void;
}

export type StreamVideoElement = HTMLVideoElement & {
  api?: EngineApi;
  nativeEl?: HTMLVideoElement;
};
