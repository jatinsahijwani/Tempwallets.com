import mixpanel from "mixpanel-browser";

let initialized = false;
let cachedToken: string | undefined;
let tokenWarningShown = false; // Prevent repeated warnings

const getToken = () => {
  if (typeof window === "undefined") return undefined;

  if (cachedToken) {
    return cachedToken;
  }

  const token =
    process.env.NEXT_PUBLIC_MIXPANEL_TOKEN ??
    process.env.NEXT_PUBLIC_MIXPANEL_TOKEN_DEV;

  if (!token) {
    // Only warn once
    if (!tokenWarningShown) {
      console.warn("Mixpanel token is not configured.");
      tokenWarningShown = true;
    }
    return undefined;
  }

  cachedToken = token;
  return token;
};

export const initMixpanel = () => {
  if (initialized) return;

  const token = getToken();
  if (!token) return;

  mixpanel.init(token, {
    debug: false,
    track_pageview: false,
    persistence: "localStorage",
  });

  initialized = true;
};

export const trackMixpanelEvent = (
  eventName: string,
  properties?: Record<string, unknown>,
) => {
  if (typeof window === "undefined") return;

  if (!initialized) {
    initMixpanel();
  }

  if (!initialized) {
    // still false when token missing
    return;
  }

  mixpanel.track(eventName, properties);
};
