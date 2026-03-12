import { Page } from "@playwright/test";

const ROCKETIUM_USER_ID_KEY = "lscache-rocketiumUserId";
const ROCKETIUM_SESSION_ID_KEY = "lscache-sessionId";

export async function injectLoginDetails(page: Page) {
  return page.evaluate(
    ({ sessionid, userid, userIdKey, sessionIdKey }) => {
      //@ts-expect-error - localStorage is available in browser context
      // eslint-disable-next-line no-undef
      localStorage.setItem(userIdKey, userid);
      //@ts-expect-error - localStorage is available in browser context
      // eslint-disable-next-line no-undef
      localStorage.setItem(sessionIdKey, sessionid);
    },
    {
      userid: process.env.PLAYWRIGHT_USER_ID,
      sessionid: process.env.PLAYWRIGHT_SESSION_ID,
      userIdKey: ROCKETIUM_USER_ID_KEY,
      sessionIdKey: ROCKETIUM_SESSION_ID_KEY,
    },
  );
}
