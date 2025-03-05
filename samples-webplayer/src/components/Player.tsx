import { useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import webplayer from "@eyevinn/web-player";
import "@eyevinn/web-player/dist/webplayer.css";

// Import the Eyevinn analytics client
import { PlayerAnalyticsConnector } from "@eyevinn/player-analytics-client-sdk-web";

interface PlayerProps {
  src: string;
  autoplay?: boolean;
}

// The eventsink endpoint
const EVENTSINK_URL =
  "https://eyevinnlab-guidetest.eyevinn-player-analytics-eventsink.auto.prod.osaas.io";

export default function Player({ src, autoplay = false }: PlayerProps) {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Generate a unique session ID for analytics
    const sessionId = uuidv4();

    // Keep references to the web player and analytics instances
    let instance: any;
    let playerAnalytics: PlayerAnalyticsConnector | undefined;

    if (elRef.current) {
      // 1) Create and load the Eyevinn web player
      instance = webplayer(elRef.current, {
        // Any optional web player config here
      });
      instance.player.load(src, autoplay);

      // 2) Find the <video> element inside the web player
      const videoEl = elRef.current.querySelector("video") as HTMLVideoElement | null;
      if (videoEl) {
        // 3) Create the analytics connector
        playerAnalytics = new PlayerAnalyticsConnector(EVENTSINK_URL);

        // 4) Initialize analytics to set up your session
        playerAnalytics
          .init({ sessionId })
          .then(() => {
            // 5) Attach the analytics to the video element to automatically capture events
            playerAnalytics?.load(videoEl);

            // 6) (Optional) Report any metadata you already know
            playerAnalytics?.reportMetadata({
              live: false,
              contentTitle: "My Content Title",
              contentUrl: src,
              // Additional metadata if/when you have it:
              // drmType: "",
              // contentId: "some-content-id",
              // userId: "user-123",
              // deviceId: "device-xyz",
              // deviceModel: "...",
              // deviceType: "...",
            });
          })
          .catch((err) => {
            console.error("Analytics init failed:", err);
            // Deinit if something goes wrong to remove any partial listeners
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