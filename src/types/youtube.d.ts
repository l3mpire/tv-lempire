/* eslint-disable @typescript-eslint/no-namespace */

/** Ambient types for the YouTube IFrame Player API */
declare namespace YT {
  enum PlayerState {
    UNSTARTED = -1,
    ENDED = 0,
    PLAYING = 1,
    PAUSED = 2,
    BUFFERING = 3,
    CUED = 5,
  }

  interface PlayerEvent {
    target: Player;
  }

  interface OnStateChangeEvent {
    target: Player;
    data: PlayerState;
  }

  interface PlayerOptions {
    width?: number | string;
    height?: number | string;
    videoId?: string;
    playerVars?: Record<string, string | number>;
    events?: {
      onReady?: (event: PlayerEvent) => void;
      onStateChange?: (event: OnStateChangeEvent) => void;
      onError?: (event: { target: Player; data: number }) => void;
    };
  }

  class Player {
    constructor(element: HTMLElement | string, options: PlayerOptions);
    playVideo(): void;
    pauseVideo(): void;
    stopVideo(): void;
    seekTo(seconds: number, allowSeekAhead?: boolean): void;
    mute(): void;
    unMute(): void;
    setLoop(loopPlaylists: boolean): void;
    setShuffle(shufflePlaylist: boolean): void;
    getPlayerState(): PlayerState;
    getCurrentTime(): number;
    getPlaylist(): string[];
    getDuration(): number;
    getPlaylistIndex(): number;
    loadPlaylist(
      playlist: string | string[],
      index?: number,
      startSeconds?: number,
    ): void;
    cuePlaylist(
      playlist: string | string[],
      index?: number,
      startSeconds?: number,
    ): void;
    destroy(): void;
  }
}

interface Window {
  YT?: typeof YT;
  onYouTubeIframeAPIReady?: () => void;
}
