import { onRequest as handleApiCheck } from "./functions/api/check.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/check") {
      return handleApiCheck({ request, env });
    }
    return env.ASSETS.fetch(request);
  },
};
