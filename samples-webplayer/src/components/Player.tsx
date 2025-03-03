import webplayer from "@eyevinn/web-player";
import { useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import "@eyevinn/web-player/dist/webplayer.css";

interface PlayerProps {
  src: string;
  autoplay?: boolean;
}

const EVENTSINK_URL =
  "https://eyevinnlab-guidetest.eyevinn-player-analytics-eventsink.auto.prod.osaas.io";

function sendEvent(event: any) {
  console.log("****** event to send:", event);
  fetch(EVENTSINK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  })
    .then((response) => {
      console.log("Response:", response);
      if (!response.ok) {
        console.error("Failed to send event:", response.statusText);
      } else {
        console.log("Event sent successfully:", event.event);
      }
    })
    .catch((error) => console.error("Error sending event:", error));
}

export default function Player({ src, autoplay = false }: PlayerProps) {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sessionId = uuidv4();
    let initSent = false;
    let playerState = "idle";
    let currentPlayhead = 0;
    let currentDuration = 0;

    if (elRef.current) {
      
      const instance = webplayer(elRef.current, {
      });

      
      const findVideoElement = () => {
        const videoEl = elRef.current?.querySelector('video');
        if (videoEl) {
          const video = videoEl as HTMLVideoElement;
          
          
          video.addEventListener('pause', () => {
            if (playerState !== "paused") {
              console.log("Native video pause event detected");
              playerState = "paused";
              
              const eventObj = {
                event: "paused",
                sessionId,
                timestamp: Date.now(),
                playhead: video.currentTime,
                duration: video.duration,
              };
              
              console.log("Sending pause event from native video:", eventObj);
              sendEvent(eventObj);
            }
          });
          
          video.addEventListener('play', () => {
            playerState = "playing";
          });
          
          video.addEventListener('ended', () => {
            if (playerState !== "stopped") {
              playerState = "stopped";
              
              const eventObj = {
                event: "stopped",
                sessionId,
                timestamp: Date.now(),
                playhead: video.currentTime,
                duration: video.duration,
                payload: {
                  reason: "ended"
                }
              };
              
              console.log("Sending stopped event from native video:", eventObj);
              sendEvent(eventObj);
            }
          });
          
          return true;
        }
        
        return false;
      };
      
      
      if (!findVideoElement()) {
        setTimeout(findVideoElement, 1000);
      }

      
      instance.player.on('*', (eventName: string, data: any) => {
        console.log(`Player event: ${eventName}`, data);
      });

     
      const events = ["playing", "seeking", "seeked", "stopped", "buffering", "buffered", "error"];

      events.forEach((ev) => {
        instance.player.on(ev, (data: any) => {
          
          if (data?.playhead !== undefined) {
            currentPlayhead = data.playhead;
          }
          if (data?.duration !== undefined) {
            currentDuration = data.duration;
          }

         
          if (ev === "playing") {
            playerState = "playing";
          } else if (ev === "stopped") {
            playerState = "stopped";
          }

          
          if (ev === "playing" && !initSent) {
            
            sendEvent({
              event: "init",
              sessionId,
              timestamp: Date.now(),
              playhead: data?.playhead ?? 0,
              duration: data?.duration ?? 0,
            });
            
            
            sendEvent({
              event: "metadata",
              sessionId,
              timestamp: Date.now(),
              playhead: data?.playhead ?? 0,
              duration: data?.duration ?? 0,
              payload: {
                live: false,
                contentTitle: "My Content",
                contentId: "",
                contentUrl: src,
                drmType: "",
                userId: "",
                deviceId: "",
                deviceModel: "",
                deviceType: "",
              }
            });
            
            initSent = true;
          }

          
          const eventObj: any = {
            event: ev,
            sessionId,
            timestamp: Date.now(),
            playhead: data?.playhead ?? currentPlayhead,
            duration: data?.duration ?? currentDuration,
          };

          
          if (ev === "stopped") {
            eventObj.payload = {
              reason: data?.reason || "ended",
            };
          } else if (ev === "error") {
            eventObj.payload = {
              category: data?.category || "UNKNOWN",
              code: data?.code || "",
              message: data?.message || "Unknown Error",
              data: data?.data || {},
            };
          }

          console.log("Sending event:", eventObj);
          sendEvent(eventObj);
        });
      });

      
      const stateMonitor = setInterval(() => {
        const videoEl = elRef.current?.querySelector('video') as HTMLVideoElement | null;
        if (videoEl) {
          if (videoEl.paused && playerState === "playing") {
            console.log("Manual detection: Video paused");
            playerState = "paused";
            
            const eventObj = {
              event: "paused",
              sessionId,
              timestamp: Date.now(),
              playhead: videoEl.currentTime,
              duration: videoEl.duration,
            };
            
            console.log("Sending pause event from manual detection:", eventObj);
            sendEvent(eventObj);
          }
        }
      }, 1000);

      
      const handleUnload = () => {
        
        if (playerState === "playing") {
          sendEvent({
            event: "stopped",
            sessionId,
            timestamp: Date.now(),
            playhead: currentPlayhead,
            duration: currentDuration,
            payload: {
              reason: "aborted" 
            }
          });
        }
      };

      window.addEventListener('beforeunload', handleUnload);

      
      instance.player.load(src, autoplay);

      
      setTimeout(() => {
        const pauseButton = elRef.current?.querySelector('.vjs-play-control, .eyevinn-pause-button, button[title="Pause"]');
        if (pauseButton) {
          pauseButton.addEventListener('click', () => {
            console.log("Pause button clicked");
            
          });
        }
      }, 1000);  

      
      return () => {
        
        if (playerState === "playing") {
          sendEvent({
            event: "stopped",
            sessionId,
            timestamp: Date.now(),
            playhead: currentPlayhead,
            duration: currentDuration,
            payload: {
              reason: "aborted" 
            }
          });
        }

        clearInterval(stateMonitor);
        window.removeEventListener('beforeunload', handleUnload);
        instance.destroy();
      };
    }
  }, [src, autoplay]);

  return <div ref={elRef} className="h-full" />;
}