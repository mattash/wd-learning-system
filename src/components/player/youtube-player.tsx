"use client";

import Script from "next/script";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface YoutubePlayerProps {
  lessonId: string;
  parishId: string;
  videoId: string;
  resumeSeconds?: number;
}

interface YouTubePlayerInstance {
  destroy: () => void;
  getCurrentTime?: () => number;
  getDuration?: () => number;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        id: string,
        options: Record<string, unknown>,
      ) => YouTubePlayerInstance;
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

async function saveProgress(payload: {
  lessonId: string;
  parishId: string;
  lastPositionSeconds: number;
  percentWatched: number;
  completed: boolean;
}) {
  await fetch("/api/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function YoutubePlayer({
  lessonId,
  parishId,
  videoId,
  resumeSeconds = 0,
}: YoutubePlayerProps) {
  const [apiReady, setApiReady] = useState(
    typeof window !== "undefined" && Boolean(window.YT?.Player),
  );
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const playerContainerId = useMemo(
    () => `yt-player-${lessonId.replaceAll("-", "")}`,
    [lessonId],
  );

  const flushProgress = useCallback(
    async (forcedCompleted = false) => {
      if (!playerRef.current) return;
      const duration = Math.max(1, playerRef.current.getDuration?.() || 1);
      const lastPosition = Math.floor(playerRef.current.getCurrentTime?.() || 0);
      const percent = Math.min(100, Math.round((lastPosition / duration) * 100));
      await saveProgress({
        lessonId,
        parishId,
        lastPositionSeconds: lastPosition,
        percentWatched: percent,
        completed: forcedCompleted || percent >= 90,
      });
    },
    [lessonId, parishId],
  );

  useEffect(() => {
    window.onYouTubeIframeAPIReady = () => setApiReady(true);
  }, []);

  useEffect(() => {
    if (!apiReady || !window.YT?.Player) return;

    const player = new window.YT.Player(playerContainerId, {
      videoId,
      events: {
        onReady: () => {
          if (resumeSeconds > 0) {
            player.seekTo(resumeSeconds, true);
          }
        },
        onStateChange: (event: { data: number }) => {
          const states = window.YT?.PlayerState;
          if (!states) return;

          if (event.data === states.PLAYING && !intervalRef.current) {
            intervalRef.current = setInterval(() => {
              void flushProgress(false);
            }, 10000);
          }

          if (event.data === states.PAUSED) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            void flushProgress(false);
          }

          if (event.data === states.ENDED) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            void flushProgress(true);
          }
        },
      },
    });

    playerRef.current = player;

    const onBeforeUnload = () => {
      void flushProgress(false);
    };

    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (intervalRef.current) clearInterval(intervalRef.current);
      void flushProgress(false);
      player.destroy();
      playerRef.current = null;
    };
  }, [apiReady, flushProgress, playerContainerId, resumeSeconds, videoId]);

  return (
    <>
      <Script src="https://www.youtube.com/iframe_api" strategy="afterInteractive" />
      <div id={playerContainerId} className="aspect-video w-full" />
    </>
  );
}
