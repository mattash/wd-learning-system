import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { YoutubePlayer } from "@/components/player/youtube-player";

vi.mock("next/script", () => ({
  default: () => null,
}));

function readBlob(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });
}

describe("YoutubePlayer", () => {
  const player = {
    destroy: vi.fn(),
    getCurrentTime: vi.fn(() => 45),
    getDuration: vi.fn(() => 120),
    seekTo: vi.fn(),
  };
  const playerConstructor = vi.fn(function Player() {
    return player;
  });
  const sendBeacon = vi.fn<(url: string | URL, data?: BodyInit | null) => boolean>(
    () => true,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response())));

    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: sendBeacon,
    });
    Object.defineProperty(window, "YT", {
      configurable: true,
      value: {
        Player: playerConstructor,
        PlayerState: {
          PLAYING: 1,
          PAUSED: 2,
          ENDED: 0,
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    delete window.YT;
    delete window.onYouTubeIframeAPIReady;
  });

  it("uses sendBeacon for beforeunload progress saves", async () => {
    render(
      <YoutubePlayer
        lessonId="lesson-1"
        parishId="parish-1"
        videoId="video-1"
      />,
    );

    await waitFor(() => {
      expect(playerConstructor).toHaveBeenCalledTimes(1);
    });

    window.dispatchEvent(new Event("beforeunload"));

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, body] = sendBeacon.mock.calls[0]!;
    expect(url).toBe("/api/progress");
    expect(body).toBeInstanceOf(Blob);
    await expect(readBlob(body as Blob)).resolves.toBe(
      JSON.stringify({
        lessonId: "lesson-1",
        parishId: "parish-1",
        lastPositionSeconds: 45,
        percentWatched: 38,
        completed: false,
      }),
    );
  });
});
