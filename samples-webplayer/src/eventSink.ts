// src/eventSink.ts
const EVENTSINK_URL =
  "https://eyevinnlab-guidetest.eyevinn-player-analytics-eventsink.auto.prod.osaas.io";

export function sendEventHHH(event: any) {
    console.log("****** event:", event);

  fetch(EVENTSINK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  })
    .then((response) => {
        console.log("****** Response:", response);
      if (!response.ok) {
        console.error("Failed to send event:", response.statusText);
      } else {
        console.log("Event sent successfully:", event.event);
      }
    })
    .catch((error) => console.error("Error sending event:", error));
}
