import * as main from '../index';

describe("event-sink module", () => {
  it("can validate an incoming POST request with a valid payload", async () => {
    const payload = {
      event: "VOD",
      sessionId: "123-456-789",
      timestamp: -1,
      playhead: -1,
      duration: -1,
      payload: {
        live: false,
        contentId: "",
        contentUrl: "",
        drmType: "",
        userId: "",
        deviceId: "",
        deviceModel: "",
        deviceType: ""
      }
    };
    const event = { path: '/', body: JSON.stringify(payload), httpMethod: 'POST' };
    let response = await main.handler(event);
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual(JSON.stringify(payload));
  });

  it("can validate an incoming POST request with an invalid payload", async () => {
    const payload = {
      event: "LIVE",
      sessionId: 789,
      timestamp: -1,
      playhead: -1,
      payload: {
        live: false,
        contentId: "",
        contentUrl: "",
        drmType: "",
        userId: "",
        deviceId: "",
        deviceModel: "",
        deviceType: ""
      }
    };
    const event = { path: '/', body: JSON.stringify(payload), httpMethod: 'POST' };
    let response = await main.handler(event);
    expect(response.statusCode).toEqual(400);
    expect(response.statusDescription).toEqual('Bad Request');
  });
});
