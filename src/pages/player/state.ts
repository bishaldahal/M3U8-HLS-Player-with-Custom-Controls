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
  return state.mediaStreamType === 'live';
}
