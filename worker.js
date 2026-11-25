import { onRequest as handleApiCheck } from "./functions/api/check.js";
import { onRequest as handleApiLead } from "./functions/api/lead.js";

function withUtf8Charset(response) {
  const ct = response.headers.get("content-type");
  if (!ct) return response;
  const lower = ct.toLowerCase();
  const isTargetText =
    lower.startsWith("text/html") ||
    lower.startsWith("text/plain") ||
    lower.startsWith("text/markdown");
  if (!isTargetText || lower.includes("charset=")) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set("content-type", `${ct}; charset=utf-8`);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. 正規化 www.anangeo.com → 301 永久轉向 https://anangeo.com
    if (url.hostname.toLowerCase() === "www.anangeo.com") {
      const target = `https://anangeo.com${url.pathname}${url.search}`;
      return new Response(null, {
        status: 301,
        headers: {
          Location: target,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // 2. API 端點：即時基礎初檢與名單解鎖
    if (url.pathname === "/api/check") {
      const selfHosts = new Set([url.hostname, "anangeo.com", "www.anangeo.com"]);
      const smartFetch = (input, init) => {
        const target = typeof input === "string" ? input : input?.url || "";
        try {
          const parsed = new URL(target);
          if (env?.ASSETS && selfHosts.has(parsed.hostname)) {
            return env.ASSETS.fetch(new Request(parsed.toString(), init)).then(withUtf8Charset);
          }
        } catch {}
        return fetch(input, init);
      };
      return handleApiCheck({ request, env, fetch: smartFetch });
    }
    if (url.pathname === "/api/lead") {
      return handleApiLead({ request, env });
    }

    // 3. Markdown 內容協商（僅當 AI 代理明確請求 text/markdown 且不要求 text/html 時）
    const accept = (request.headers.get("accept") || "").toLowerCase();
    if (
      (url.pathname === "/" || url.pathname === "/index.html") &&
      accept.includes("text/markdown") &&
      !accept.includes("text/html")
    ) {
      const mdReq = new Request(new URL("/llms.txt", url.origin).toString(), {
        method: request.method,
        headers: request.headers,
      });
      const mdResp = await env.ASSETS.fetch(mdReq);
      if (mdResp.ok) {
        const headers = new Headers(mdResp.headers);
        headers.set("content-type", "text/markdown; charset=utf-8");
        headers.set("vary", "Accept");
        return new Response(mdResp.body, {
          status: mdResp.status,
          statusText: mdResp.statusText,
          headers,
        });
      }
    }

    // 4. 靜態資產派發並為 text/html、text/plain 補齊 charset=utf-8
    const assetResp = await env.ASSETS.fetch(request);
    return withUtf8Charset(assetResp);
  },
};
