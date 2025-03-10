import { useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import webplayer from "@eyevinn/web-player";
import "@eyevinn/web-player/dist/webplayer.css";
import { PlayerAnalyticsConnector } from "@eyevinn/player-analytics-client-sdk-web";

interface PlayerProps {
  src: string;
  autoplay?: boolean;
}

const EVENTSINK_URL =
  "https://eyevinnlab-guidetest.eyevinn-player-analytics-eventsink.auto.prod.osaas.io";

export default function Player({ src, autoplay = false }: PlayerProps) {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sessionId = uuidv4();

    let instance: any;
    let playerAnalytics: PlayerAnalyticsConnector | undefined;

    if (elRef.current) {
      instance = webplayer(elRef.current, {});
      instance.player.load(src, autoplay);

      const videoEl = elRef.current.querySelector("video") as HTMLVideoElement | null;
      if (videoEl) {
        playerAnalytics = new PlayerAnalyticsConnector(EVENTSINK_URL);

        // 4) Initialize analytics to set up your session
        playerAnalytics
          .init({ sessionId, heartbeatInterval: 10_000 })
          .then(() => {
            // 5) Attach the analytics to the video element to automatically capture events
            playerAnalytics?.load(videoEl);

            playerAnalytics?.reportMetadata({
              live: false,
              contentTitle: "VINN promo reel",
              contentId: "VINN-2021-01",
              contentUrl: src,
              // Additional metadata if/when you have it:
              // drmType: "",
              // userId: "user-123",
              // deviceId: "device-xyz",
              // deviceModel: "...",
              // deviceType: "...",
            });
          })
          .catch((err) => {
            console.error("Analytics init failed:", err);
            playerAnalytics?.deinit();
          });
      }
    }

    // CLEANUP: Report stop, destroy analytics, and destroy the web player when component unmounts
    return () => {
      if (playerAnalytics) {
        // Properly stop analytics
        playerAnalytics.reportStop();
        playerAnalytics.destroy();
      }
      instance?.destroy();
    };
  }, [src, autoplay]);

  return <div ref={elRef} className="h-full" />;
}