import type { StreamType } from '../../lib/stream';
import type { StreamVideoElement } from './types';

export const state = {
  controller: null as HTMLElement | null,
  video: null as StreamVideoElement | null,
  /** media-chrome's `mediastreamtype` attribute: 'live' | 'on-demand' | null. */
  mediaStreamType: null as string | null,
  streamType: null as StreamType | null,
  resumePosition: 0,
  streamUrl: '',
  streamTitle: '',
};

export function isLive(): boolean {
  // media-chrome sets mediastreamtype asynchronously, so re-read it and fall back to duration.
  const type = state.controller?.getAttribute('mediastreamtype') ?? state.mediaStreamType;
  return type === 'live' || state.video?.duration === Infinity;
}
