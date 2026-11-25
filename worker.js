import { onRequest as handleApiCheck } from "./functions/api/check.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/check") {
      const selfHosts = new Set([url.hostname, "anangeo.com", "www.anangeo.com"]);
      const smartFetch = (input, init) => {
        const target = typeof input === "string" ? input : input?.url || "";
        try {
          const parsed = new URL(target);
          if (env?.ASSETS && selfHosts.has(parsed.hostname)) {
            return env.ASSETS.fetch(new Request(parsed.toString(), init));
          }
        } catch {}
        return fetch(input, init);
      };
      return handleApiCheck({ request, env, fetch: smartFetch });
    }
    return env.ASSETS.fetch(request);
  },
};
