/**
 * Cloudflare Pages Function: GET /api/check?url=<target>
 * 阿男 GEO 實戰工坊 — 10 秒免費基礎 GEO 初檢（純標準 Web API、零外部依賴）
 *
 * 實測三項基礎指標（絕不捏造數字，抓不到明確標示「無法讀取／未設置」）：
 * 1. AI 爬蟲放行（/robots.txt）
 * 2. AI 導覽索引（/llms.txt）
 * 3. 官網結構與標籤（首頁 HTTP 狀態、title、description、canonical、JSON-LD @type）
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const FETCH_TIMEOUT_MS = 6000;
const MAX_REDIRECTS = 4;
const MAX_ROBOTS_BYTES = 128 * 1024;
const MAX_LLMS_BYTES = 256 * 1024;
const MAX_HTML_BYTES = 512 * 1024;

const SEARCH_BOTS = [
  "Googlebot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "DeepSeekBot",
];

const TRAINING_BOTS = ["GPTBot", "ClaudeBot"];

const DISCLAIMER_TEXT =
  "本工具僅為基礎公開頁初檢（即時檢查 robots.txt、llms.txt 與首頁 HTML／JSON-LD），不含 20 題跨平台 AI 實測、站外舊快照追查與 WAF 深度掃描；分數亦不代表 AI 必然點名或排名。";

const BLOCKED_HOST_EXACT = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "metadata",
  "metadata.google.internal",
  "instance-data",
]);

const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".localdomain",
  ".home.arpa",
  ".intranet",
  ".lan",
];

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...CORS_HEADERS,
    },
  });
}

function isPrivateIpv4Octets(a, b, c, d) {
  if ([a, b, c, d].some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // IETF / TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast & reserved & 255.255.255.255
  return false;
}

function parseIpv4(host) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const octets = m.slice(1).map((s) => Number(s));
  if (octets.some((n) => n < 0 || n > 255)) return null;
  return octets;
}

function expandIpv6(rawHost) {
  let addr = rawHost.toLowerCase();
  const zoneIdx = addr.indexOf("%");
  if (zoneIdx !== -1) addr = addr.slice(0, zoneIdx);

  // Convert trailing dotted IPv4 (e.g. ::ffff:127.0.0.1) to two hex groups
  const lastColon = addr.lastIndexOf(":");
  if (lastColon !== -1 && addr.slice(lastColon + 1).includes(".")) {
    const v4 = parseIpv4(addr.slice(lastColon + 1));
    if (!v4) return null;
    const hi = ((v4[0] << 8) | v4[1]).toString(16);
    const lo = ((v4[2] << 8) | v4[3]).toString(16);
    addr = `${addr.slice(0, lastColon + 1)}${hi}:${lo}`;
  }

  const parts = addr.split("::");
  if (parts.length > 2) return null;

  const left = parts[0] ? parts[0].split(":").filter(Boolean) : [];
  const right = parts[1] ? parts[1].split(":").filter(Boolean) : [];
  const missing = 8 - (left.length + right.length);
  if (parts.length === 1 && left.length !== 8) return null;
  if (parts.length === 2 && missing < 0) return null;

  const full = parts.length === 2 ? [...left, ...Array(missing).fill("0"), ...right] : left;
  if (full.length !== 8) return null;

  const groups = [];
  for (const g of full) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    groups.push(parseInt(g, 16));
  }
  return groups;
}

function isPrivateIpv6(host) {
  const groups = expandIpv6(host);
  if (!groups) return true; // Malformed IPv6 -> block

  const allZero = groups.every((g) => g === 0);
  if (allZero) return true; // ::

  const isLoopback = groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1;
  if (isLoopback) return true; // ::1

  const first = groups[0];
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA (fc* / fd*)
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (deprecated)
  if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (first === 0x2001 && groups[1] === 0x0db8) return true; // documentation

  // IPv4-mapped ::ffff:0:0/96 or IPv4-compatible ::/96
  const zeroPrefix5 = groups.slice(0, 5).every((g) => g === 0);
  if (zeroPrefix5 && (groups[5] === 0xffff || groups[5] === 0x0000)) {
    const a = (groups[6] >> 8) & 0xff;
    const b = groups[6] & 0xff;
    const c = (groups[7] >> 8) & 0xff;
    const d = groups[7] & 0xff;
    if (isPrivateIpv4Octets(a, b, c, d)) return true;
  }

  return false;
}

export function validatePublicUrl(rawInput) {
  if (typeof rawInput !== "string") {
    return { ok: false, code: "MISSING_URL", error: "請輸入要檢測的公開網站網址。" };
  }
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { ok: false, code: "MISSING_URL", error: "請輸入要檢測的公開網站網址。" };
  }
  if (trimmed.length > 2048 || /\s/.test(trimmed)) {
    return { ok: false, code: "INVALID_URL", error: "網址格式不正確，請輸入完整的公開網址（例如 https://anangeo.com）。" };
  }

  let candidate = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, code: "INVALID_URL", error: "網址無法解析，請確認是否為有效的 http:// 或 https:// 網址。" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, code: "INVALID_PROTOCOL", error: "僅支援 http:// 或 https:// 公開網址。" };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, code: "INVALID_URL", error: "不允許包含帳號或密碼的網址。" };
  }

  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
    return { ok: false, code: "INVALID_PORT", error: "基於安全限制，僅支援標準網頁連接埠（80／443）。" };
  }

  const rawHost = parsed.hostname.toLowerCase().replace(/\.+$/, "");
  const host = rawHost.startsWith("[") && rawHost.endsWith("]") ? rawHost.slice(1, -1) : rawHost;

  if (!host) {
    return { ok: false, code: "INVALID_URL", error: "網址缺少有效的網域名稱。" };
  }

  if (
    BLOCKED_HOST_EXACT.has(host) ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  ) {
    return { ok: false, code: "SSRF_BLOCKED", error: "基於安全限制，不允許檢測本機或內部網域名稱。" };
  }

  // IPv6 literal
  if (host.includes(":")) {
    if (isPrivateIpv6(host)) {
      return { ok: false, code: "SSRF_BLOCKED", error: "基於安全限制，不允許檢測迴路或私有 IPv6 位址。" };
    }
    return { ok: true, url: parsed };
  }

  // IPv4 literal
  const ipv4 = parseIpv4(host);
  if (ipv4) {
    if (isPrivateIpv4Octets(ipv4[0], ipv4[1], ipv4[2], ipv4[3])) {
      return { ok: false, code: "SSRF_BLOCKED", error: "基於安全限制，不允許檢測本機或私有網段 IP 位址。" };
    }
    return { ok: true, url: parsed };
  }

  // Reject single-label or numeric-only / malformed hostnames
  if (!host.includes(".")) {
    return { ok: false, code: "INVALID_URL", error: "請輸入完整的公開網域名稱（例如 https://anangeo.com）。" };
  }

  const labels = host.split(".");
  const labelRe = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
  if (labels.some((label) => !labelRe.test(label))) {
    return { ok: false, code: "INVALID_URL", error: "網域名稱包含無效字元，請重新確認網址。" };
  }

  const tld = labels[labels.length - 1];
  if (tld.length < 2 || /^\d+$/.test(tld)) {
    return { ok: false, code: "INVALID_URL", error: "請輸入具備有效頂級網域的公開網址。" };
  }

  return { ok: true, url: parsed };
}

async function readBodyLimited(response, maxBytes) {
  if (!response.body || typeof response.body.getReader !== "function") {
    const raw = await response.text();
    const encoder = new TextEncoder();
    const encoded = encoder.encode(raw);
    if (encoded.byteLength > maxBytes) {
      const sliced = encoded.slice(0, maxBytes);
      return {
        text: new TextDecoder("utf-8", { fatal: false }).decode(sliced),
        byteLength: sliced.byteLength,
        truncated: true,
      };
    }
    return { text: raw, byteLength: encoded.byteLength, truncated: false };
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  let truncated = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;

      if (total + value.byteLength > maxBytes) {
        const remaining = maxBytes - total;
        if (remaining > 0) {
          chunks.push(value.subarray(0, remaining));
          total += remaining;
        }
        truncated = true;
        try {
          await reader.cancel();
        } catch {
          // ignore cancel errors
        }
        break;
      }

      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore release errors
    }
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const text = new TextDecoder("utf-8", { fatal: false }).decode(combined);
  return { text, byteLength: total, truncated };
}

async function safeFetchText(startUrl, { maxBytes, accept, fetchFn }) {
  let currentUrl = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const check = validatePublicUrl(currentUrl);
    if (!check.ok) {
      return {
        ok: false,
        status: null,
        finalUrl: currentUrl,
        contentType: "",
        text: "",
        byteLength: 0,
        truncated: false,
        errorType: check.code === "SSRF_BLOCKED" ? "ssrf_redirect" : "invalid_redirect",
        errorMessage:
          hop === 0
            ? check.error
            : "重新導向目標屬於私網或不安全位址，已基於安全原則攔截。",
      };
    }

    let resp;
    try {
      resp = await fetchFn(check.url.href, {
        method: "GET",
        redirect: "manual",
        headers: {
          "User-Agent": "AnanGEO-BasicCheck/1.0 (+https://anangeo.com)",
          Accept: accept,
          "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.5",
        },
        signal: AbortSignal.timeout(6000),
      });
    } catch (err) {
      const isTimeout =
        err?.name === "TimeoutError" ||
        err?.name === "AbortError" ||
        /timeout|aborted/i.test(String(err?.message || ""));
      return {
        ok: false,
        status: null,
        finalUrl: currentUrl,
        contentType: "",
        text: "",
        byteLength: 0,
        truncated: false,
        errorType: isTimeout ? "timeout" : "network",
        errorMessage: isTimeout
          ? `連線逾時（超過 ${Math.round(FETCH_TIMEOUT_MS / 1000)} 秒）`
          : "無法建立連線或目標主機拒絕回應",
      };
    }

    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get("location");
      if (location) {
        if (hop === MAX_REDIRECTS) {
          return {
            ok: false,
            status: resp.status,
            finalUrl: currentUrl,
            contentType: resp.headers.get("content-type") || "",
            text: "",
            byteLength: 0,
            truncated: false,
            errorType: "too_many_redirects",
            errorMessage: "重新導向次數過多，無法完成讀取",
          };
        }
        try {
          currentUrl = new URL(location, check.url.href).href;
        } catch {
          return {
            ok: false,
            status: resp.status,
            finalUrl: currentUrl,
            contentType: "",
            text: "",
            byteLength: 0,
            truncated: false,
            errorType: "invalid_redirect",
            errorMessage: "重新導向網址無效",
          };
        }
        continue;
      }
    }

    const contentType = resp.headers.get("content-type") || "";
    try {
      const { text, byteLength, truncated } = await readBodyLimited(resp, maxBytes);
      return {
        ok: true,
        status: resp.status,
        finalUrl: check.url.href,
        contentType,
        text,
        byteLength,
        truncated,
        errorType: null,
        errorMessage: null,
      };
    } catch {
      return {
        ok: false,
        status: resp.status,
        finalUrl: check.url.href,
        contentType,
        text: "",
        byteLength: 0,
        truncated: false,
        errorType: "read_error",
        errorMessage: "回應內容讀取中斷",
      };
    }
  }

  return {
    ok: false,
    status: null,
    finalUrl: currentUrl,
    contentType: "",
    text: "",
    byteLength: 0,
    truncated: false,
    errorType: "unknown",
    errorMessage: "無法讀取目標資源",
  };
}

function looksLikeHtml(text, contentType = "") {
  const ct = String(contentType || "").toLowerCase();
  if (ct.includes("text/html") || ct.includes("application/xhtml+xml")) {
    return true;
  }
  const sample = String(text || "").slice(0, 2000);
  if (/^\s*(?:<!doctype\s+html|<html\b|<head\b|<body\b)/i.test(sample)) {
    return true;
  }
  if (/<html\b/i.test(sample) && /<\/(?:html|head|body)>/i.test(text.slice(0, 8000))) {
    return true;
  }
  return false;
}

export function parseRobotsTxt(text) {
  const lines = String(text || "").split(/\r?\n/);
  const groups = [];
  let currentAgents = [];
  let currentRules = [];
  let seenRuleInGroup = false;

  const flushGroup = () => {
    if (currentAgents.length > 0) {
      groups.push({ agents: [...currentAgents], rules: [...currentRules] });
    }
    currentAgents = [];
    currentRules = [];
    seenRuleInGroup = false;
  };

  for (const rawLine of lines) {
    const noComment = rawLine.replace(/#.*$/, "").trim();
    if (!noComment) {
      if (currentAgents.length > 0 && seenRuleInGroup) {
        flushGroup();
      }
      continue;
    }

    const colonIdx = noComment.indexOf(":");
    if (colonIdx === -1) continue;
    const directive = noComment.slice(0, colonIdx).trim().toLowerCase();
    const value = noComment.slice(colonIdx + 1).trim();

    if (directive === "user-agent") {
      if (seenRuleInGroup) {
        flushGroup();
      }
      if (value) {
        currentAgents.push(value.toLowerCase());
      }
    } else if (directive === "allow" || directive === "disallow") {
      if (currentAgents.length > 0) {
        seenRuleInGroup = true;
        currentRules.push({ type: directive, path: value });
      }
    }
  }
  flushGroup();

  const evaluateBot = (botName) => {
    const key = botName.toLowerCase();
    const explicitRules = [];
    const wildcardRules = [];

    for (const grp of groups) {
      if (grp.agents.includes(key)) {
        explicitRules.push(...grp.rules);
      }
      if (grp.agents.includes("*")) {
        wildcardRules.push(...grp.rules);
      }
    }

    const activeRules = explicitRules.length > 0 ? explicitRules : wildcardRules;
    const ruleSource =
      explicitRules.length > 0 ? "explicit" : wildcardRules.length > 0 ? "wildcard" : "default";

    if (activeRules.length === 0) {
      return { bot: botName, allowed: true, ruleSource };
    }

    let bestType = "allow";
    let bestLen = -1;

    for (const rule of activeRules) {
      if (rule.type === "disallow" && rule.path === "") {
        // Empty Disallow means allow everything
        if (0 >= bestLen) {
          bestLen = 0;
          bestType = "allow";
        }
        continue;
      }

      // Check match against root path "/"
      const pathRule = rule.path;
      const matchesRoot =
        pathRule === "/" ||
        pathRule === "/*" ||
        pathRule === "/$" ||
        pathRule === "*";

      if (!matchesRoot) continue;
      const specificity = pathRule.length;
      if (specificity > bestLen || (specificity === bestLen && rule.type === "allow")) {
        bestLen = specificity;
        bestType = rule.type;
      }
    }

    return { bot: botName, allowed: bestType !== "disallow", ruleSource };
  };

  return {
    groupsCount: groups.length,
    searchBots: SEARCH_BOTS.map(evaluateBot),
    trainingBots: TRAINING_BOTS.map(evaluateBot),
  };
}

function evaluateRobotsCheck(res) {
  if (!res.ok) {
    return {
      key: "robots",
      title: "AI 爬蟲放行（robots.txt）",
      light: "red",
      score: 0,
      max_score: 35,
      http_status: res.status,
      readable: false,
      search_bots_allowed: null,
      search_bots_total: SEARCH_BOTS.length,
      training_distinguished: false,
      search_bots: SEARCH_BOTS.map((bot) => ({ bot, allowed: null, ruleSource: "unavailable" })),
      training_bots: TRAINING_BOTS.map((bot) => ({ bot, allowed: null, ruleSource: "unavailable" })),
      summary: `無法讀取 /robots.txt（${res.errorMessage}）。`,
      recommendation:
        "先確認網站根目錄 /robots.txt 可由外部正常讀取且未被防火牆／WAF 攔截，避免 AI 搜尋爬蟲連門都進不來。",
    };
  }

  if (res.status === 404 || res.status === 410 || (res.status === 200 && looksLikeHtml(res.text, res.contentType))) {
    const reason = res.status === 200 ? "回傳 HTML 網頁而非純文字規則" : `HTTP ${res.status}`;
    return {
      key: "robots",
      title: "AI 爬蟲放行（robots.txt）",
      light: "yellow",
      score: 15,
      max_score: 35,
      http_status: res.status,
      readable: false,
      search_bots_allowed: null,
      search_bots_total: SEARCH_BOTS.length,
      training_distinguished: false,
      search_bots: SEARCH_BOTS.map((bot) => ({ bot, allowed: null, ruleSource: "missing" })),
      training_bots: TRAINING_BOTS.map((bot) => ({ bot, allowed: null, ruleSource: "missing" })),
      summary: `未設置有效的 /robots.txt（${reason}）；搜尋爬蟲雖預設不擋，但無法明確分流 AI 搜尋與訓練爬蟲。`,
      recommendation:
        "在根目錄補上純文字 /robots.txt：明確放行 OAI-SearchBot、ChatGPT-User、Claude-SearchBot、PerplexityBot、DeepSeekBot、Googlebot，並依需求單獨設定 GPTBot／ClaudeBot 訓練政策。",
    };
  }

  if (res.status !== 200) {
    return {
      key: "robots",
      title: "AI 爬蟲放行（robots.txt）",
      light: "red",
      score: 0,
      max_score: 35,
      http_status: res.status,
      readable: false,
      search_bots_allowed: null,
      search_bots_total: SEARCH_BOTS.length,
      training_distinguished: false,
      search_bots: SEARCH_BOTS.map((bot) => ({ bot, allowed: null, ruleSource: "error" })),
      training_bots: TRAINING_BOTS.map((bot) => ({ bot, allowed: null, ruleSource: "error" })),
      summary: `無法讀取 /robots.txt（HTTP ${res.status}），請檢查主機權限或 WAF 設定。`,
      recommendation:
        `修復 /robots.txt 回傳異常（目前 HTTP ${res.status}），確保搜尋與 AI 問答爬蟲可正常取得抓取規則。`,
    };
  }

  const parsed = parseRobotsTxt(res.text);
  const allowedCount = parsed.searchBots.filter((b) => b.allowed).length;
  const blockedSearch = parsed.searchBots.filter((b) => !b.allowed).map((b) => b.bot);
  const explicitTraining = parsed.trainingBots.filter((b) => b.ruleSource === "explicit");
  const trainingDistinguished = explicitTraining.length > 0;
  const blockedTraining = parsed.trainingBots.filter((b) => !b.allowed).map((b) => b.bot);

  const searchScore = Math.round((allowedCount / SEARCH_BOTS.length) * 28);
  const trainingBonus = explicitTraining.length >= 2 ? 7 : explicitTraining.length === 1 ? 4 : 0;
  const score = Math.min(35, searchScore + trainingBonus);

  let light = "red";
  if (allowedCount === SEARCH_BOTS.length && trainingDistinguished) {
    light = "green";
  } else if (allowedCount >= 3) {
    light = "yellow";
  }

  let summary;
  if (allowedCount === SEARCH_BOTS.length && trainingDistinguished) {
    const trainNote =
      blockedTraining.length > 0
        ? `已明確區分訓練爬蟲（封鎖 ${blockedTraining.join("、")}）`
        : `已明確單獨設定訓練爬蟲規則（${explicitTraining.map((b) => b.bot).join("、")}）`;
    summary = `6 / 6 主流 AI 搜尋與問答爬蟲全數放行，且${trainNote}。`;
  } else if (allowedCount === SEARCH_BOTS.length) {
    summary = "6 / 6 主流 AI 搜尋爬蟲可通過，但尚未在 robots.txt 單獨區分模型訓練爬蟲（GPTBot、ClaudeBot）。";
  } else if (allowedCount > 0) {
    summary = `僅放行 ${allowedCount} / 6 主流 AI 搜尋爬蟲，目前封鎖：${blockedSearch.join("、")}。`;
  } else {
    summary = "robots.txt 已阻擋全部 6 個主流 AI 搜尋爬蟲，AI 將難以檢索官網內容。";
  }

  let recommendation = null;
  if (blockedSearch.length > 0) {
    recommendation = `於 /robots.txt 放行被擋住的搜尋爬蟲（${blockedSearch.join("、")}），避免 ChatGPT、Perplexity 或 Gemini 跳過你的官網。`;
  } else if (!trainingDistinguished) {
    recommendation =
      "建議在 /robots.txt 明確區分「AI 搜尋爬蟲（Allow）」與「模型訓練爬蟲 GPTBot／ClaudeBot（依版權政策決定 Allow 或 Disallow）」。";
  }

  return {
    key: "robots",
    title: "AI 爬蟲放行（robots.txt）",
    light,
    score,
    max_score: 35,
    http_status: res.status,
    readable: true,
    search_bots_allowed: allowedCount,
    search_bots_total: SEARCH_BOTS.length,
    training_distinguished: trainingDistinguished,
    search_bots: parsed.searchBots,
    training_bots: parsed.trainingBots,
    summary,
    recommendation,
  };
}

function evaluateLlmsCheck(res) {
  if (!res.ok) {
    return {
      key: "llms",
      title: "AI 導覽索引（llms.txt）",
      light: "red",
      score: 0,
      max_score: 30,
      http_status: res.status,
      content_length: 0,
      valid_plain_text: false,
      is_html_misleading: false,
      has_heading: false,
      has_links_or_list: false,
      summary: `無法讀取 /llms.txt（${res.errorMessage}）。`,
      recommendation:
        "先確認網站連線穩定，再於根目錄建立純文字 /llms.txt，提供 5～8 個核心頁面與品牌定位摘要。",
    };
  }

  if (res.status === 404 || res.status === 410) {
    return {
      key: "llms",
      title: "AI 導覽索引（llms.txt）",
      light: "red",
      score: 0,
      max_score: 30,
      http_status: res.status,
      content_length: 0,
      valid_plain_text: false,
      is_html_misleading: false,
      has_heading: false,
      has_links_or_list: false,
      summary: `未設置 /llms.txt（HTTP ${res.status}）。`,
      recommendation:
        "在網站根目錄新增 /llms.txt（純文字 Markdown），列出品牌一句話定位、主力價格方案、服務邊界、5～8 個核心頁與官方聯絡入口。",
    };
  }

  if (res.status !== 200) {
    return {
      key: "llms",
      title: "AI 導覽索引（llms.txt）",
      light: "red",
      score: 0,
      max_score: 30,
      http_status: res.status,
      content_length: res.text.trim().length,
      valid_plain_text: false,
      is_html_misleading: false,
      has_heading: false,
      has_links_or_list: false,
      summary: `無法讀取有效 /llms.txt（HTTP ${res.status}）。`,
      recommendation:
        `調整主機路由讓 /llms.txt 回傳 HTTP 200 純文字檔案（目前回傳 HTTP ${res.status}）。`,
    };
  }

  const trimmed = res.text.trim();
  const isHtml = looksLikeHtml(res.text, res.contentType);
  if (isHtml) {
    return {
      key: "llms",
      title: "AI 導覽索引（llms.txt）",
      light: "red",
      score: 0,
      max_score: 30,
      http_status: res.status,
      content_length: trimmed.length,
      valid_plain_text: false,
      is_html_misleading: true,
      has_heading: false,
      has_links_or_list: false,
      summary: "偵測到 /llms.txt 回傳 HTTP 200，但實際內容為 HTML 網頁（軟 404 誤導頁），並非有效純文字索引。",
      recommendation:
        "網站把找不到的路徑導回首頁或自訂 404 HTML 了！請在靜態根目錄實際放置純文字 /llms.txt（Content-Type: text/plain 或 text/markdown）。",
    };
  }

  if (trimmed.length === 0) {
    return {
      key: "llms",
      title: "AI 導覽索引（llms.txt）",
      light: "red",
      score: 0,
      max_score: 30,
      http_status: res.status,
      content_length: 0,
      valid_plain_text: false,
      is_html_misleading: false,
      has_heading: false,
      has_links_or_list: false,
      summary: "/llms.txt 雖回傳 HTTP 200，但檔案內容為空（0 字元）。",
      recommendation:
        "補齊 /llms.txt 內容，寫明品牌定位、核心方案、不承接邊界與 5～8 個核心正式頁網址。",
    };
  }

  const hasHeading = /^#{1,3}\s+\S+/m.test(trimmed);
  const hasLinksOrList = /(?:https?:\/\/|^\s*[-*]\s+\S+)/m.test(trimmed);
  const wellStructured = trimmed.length >= 80 && (hasHeading || hasLinksOrList);

  if (wellStructured) {
    return {
      key: "llms",
      title: "AI 導覽索引（llms.txt）",
      light: "green",
      score: 30,
      max_score: 30,
      http_status: res.status,
      content_length: trimmed.length,
      valid_plain_text: true,
      is_html_misleading: false,
      has_heading: hasHeading,
      has_links_or_list: hasLinksOrList,
      summary: `已部署有效純文字 /llms.txt（HTTP 200，共 ${trimmed.length.toLocaleString("en-US")} 字元，具標題與索引結構）。`,
      recommendation: null,
    };
  }

  return {
    key: "llms",
    title: "AI 導覽索引（llms.txt）",
    light: "yellow",
    score: 18,
    max_score: 30,
    http_status: res.status,
    content_length: trimmed.length,
    valid_plain_text: true,
    is_html_misleading: false,
    has_heading: hasHeading,
    has_links_or_list: hasLinksOrList,
    summary: `已設置純文字 /llms.txt（HTTP 200，${trimmed.length} 字元），但內容偏精簡或缺少 Markdown 標題與重點頁面連結。`,
    recommendation:
      "建議擴充 /llms.txt 至結構化目錄格式（# 品牌標題、> 一句話定位、## 核心頁面清單與官方聯絡入口）。",
  };
}

function decodeHtmlEntities(str) {
  return String(str || "")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAttr(tagHtml, attrName) {
  const re = new RegExp(`\\b${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\\x60]+))`, "i");
  const m = re.exec(tagHtml);
  if (!m) return null;
  const val = m[1] ?? m[2] ?? m[3] ?? "";
  return decodeHtmlEntities(val);
}

function collectSchemaTypes(node, outSet) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectSchemaTypes(item, outSet);
    return;
  }
  if (typeof node["@type"] === "string" && node["@type"].trim()) {
    outSet.add(node["@type"].trim());
  } else if (Array.isArray(node["@type"])) {
    for (const t of node["@type"]) {
      if (typeof t === "string" && t.trim()) outSet.add(t.trim());
    }
  }
  for (const val of Object.values(node)) {
    if (val && typeof val === "object") {
      collectSchemaTypes(val, outSet);
    }
  }
}

export function parseHtmlMetadata(html) {
  const src = String(html || "");

  // <title>
  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(src);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].replace(/<[^>]+>/g, " ")) : null;

  // <meta name="description">
  let description = null;
  const metaRe = /<meta\b[^>]*>/gi;
  let metaMatch;
  while ((metaMatch = metaRe.exec(src)) !== null) {
    const tag = metaMatch[0];
    const name = extractAttr(tag, "name");
    if (name && name.toLowerCase() === "description") {
      const content = extractAttr(tag, "content");
      if (content) {
        description = content;
        break;
      }
    }
  }

  // <link rel="canonical">
  let canonical = null;
  const linkRe = /<link\b[^>]*>/gi;
  let linkMatch;
  while ((linkMatch = linkRe.exec(src)) !== null) {
    const tag = linkMatch[0];
    const rel = extractAttr(tag, "rel");
    if (rel && rel.toLowerCase().split(/\s+/).includes("canonical")) {
      const href = extractAttr(tag, "href");
      if (href) {
        canonical = href;
        break;
      }
    }
  }

  // <script type="application/ld+json">
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let jsonLdCount = 0;
  let invalidJsonLdCount = 0;
  const schemaTypeSet = new Set();
  let scriptMatch;
  while ((scriptMatch = scriptRe.exec(src)) !== null) {
    const attrs = scriptMatch[1] || "";
    const typeAttr = extractAttr(`<script ${attrs}>`, "type");
    if (!typeAttr || !typeAttr.toLowerCase().includes("application/ld+json")) continue;

    const rawJson = (scriptMatch[2] || "").trim();
    if (!rawJson) {
      invalidJsonLdCount += 1;
      continue;
    }
    try {
      const parsed = JSON.parse(rawJson);
      jsonLdCount += 1;
      collectSchemaTypes(parsed, schemaTypeSet);
    } catch {
      invalidJsonLdCount += 1;
    }
  }

  return {
    title: title || null,
    description: description || null,
    canonical: canonical || null,
    json_ld_count: jsonLdCount,
    invalid_json_ld_count: invalidJsonLdCount,
    schema_types: [...schemaTypeSet],
  };
}

function evaluateHomepageCheck(res) {
  if (!res.ok) {
    return {
      key: "homepage",
      title_label: "官網結構與標籤（首頁 HTML）",
      light: "red",
      score: 0,
      max_score: 35,
      http_status: res.status,
      final_url: res.finalUrl,
      truncated: false,
      title: null,
      description: null,
      canonical: null,
      json_ld_count: 0,
      invalid_json_ld_count: 0,
      schema_types: [],
      summary: `無法讀取首頁 HTML（${res.errorMessage}）。`,
      recommendation:
        "確認首頁網址對外可正常連線並回傳 HTTP 200 靜態 HTML，避免主機逾時或防火牆阻擋爬蟲。",
    };
  }

  if (res.status < 200 || res.status >= 300) {
    return {
      key: "homepage",
      title_label: "官網結構與標籤（首頁 HTML）",
      light: "red",
      score: 0,
      max_score: 35,
      http_status: res.status,
      final_url: res.finalUrl,
      truncated: res.truncated,
      title: null,
      description: null,
      canonical: null,
      json_ld_count: 0,
      invalid_json_ld_count: 0,
      schema_types: [],
      summary: `首頁回傳 HTTP ${res.status}（非 200 正常頁），AI 爬蟲無法穩定讀取。`,
      recommendation:
        `修復首頁 HTTP ${res.status} 狀態，確保正式公開網址直接回傳 HTTP 200 與完整 HTML 正文。`,
    };
  }

  const meta = parseHtmlMetadata(res.text);
  let score = 0;
  const missing = [];

  if (meta.title) score += 8;
  else missing.push("<title> 網頁標題");

  if (meta.description) score += 8;
  else missing.push('<meta name="description"> 頁面摘要');

  if (meta.canonical) score += 7;
  else missing.push('<link rel="canonical"> 標準網址');

  if (meta.json_ld_count > 0) {
    score += meta.schema_types.length >= 3 ? 12 : 8;
  } else {
    missing.push("application/ld+json 結構化資料（Schema）");
  }

  let light = "red";
  if (score >= 28) light = "green";
  else if (score >= 14) light = "yellow";

  let summary;
  if (missing.length === 0) {
    const typesPreview = meta.schema_types.slice(0, 5).join("、") || "已解析";
    summary = `首頁 HTTP ${res.status} 正常；title、description、canonical 與 ${meta.json_ld_count} 組 JSON-LD（${typesPreview}）皆已齊備。`;
  } else {
    summary = `首頁 HTTP ${res.status} 可讀取，但缺少：${missing.join("、")}。`;
  }

  let recommendation = null;
  if (missing.length > 0) {
    recommendation = `補齊首頁 HTML 缺少的基礎結構：${missing.join("、")}，並確保 JSON-LD 裡的品牌名稱與價格和訪客看到的純文字完全一致。`;
  } else if (meta.schema_types.length < 3) {
    recommendation =
      "首頁已有基礎 JSON-LD，建議以單一 @graph 串起品牌（Organization／Person）、服務與報價（Service／Offer）與常見問答（FAQPage）。";
  }

  return {
    key: "homepage",
    title_label: "官網結構與標籤（首頁 HTML）",
    light,
    score,
    max_score: 35,
    http_status: res.status,
    final_url: res.finalUrl,
    truncated: res.truncated,
    title: meta.title,
    description: meta.description,
    canonical: meta.canonical,
    json_ld_count: meta.json_ld_count,
    invalid_json_ld_count: meta.invalid_json_ld_count,
    schema_types: meta.schema_types,
    summary,
    recommendation,
  };
}

export async function runGeoBasicCheck(targetUrlObj, fetchFn = globalThis.fetch) {
  const startedAt = Date.now();
  const origin = targetUrlObj.origin;

  const [robotsRes, llmsRes, homeRes] = await Promise.all([
    safeFetchText(`${origin}/robots.txt`, {
      maxBytes: MAX_ROBOTS_BYTES,
      accept: "text/plain, text/*;q=0.9, */*;q=0.1",
      fetchFn,
    }),
    safeFetchText(`${origin}/llms.txt`, {
      maxBytes: MAX_LLMS_BYTES,
      accept: "text/markdown, text/plain;q=0.9, */*;q=0.1",
      fetchFn,
    }),
    safeFetchText(targetUrlObj.href, {
      maxBytes: MAX_HTML_BYTES,
      accept: "text/html, application/xhtml+xml;q=0.9, */*;q=0.1",
      fetchFn,
    }),
  ]);

  const robots = evaluateRobotsCheck(robotsRes);
  const llms = evaluateLlmsCheck(llmsRes);
  const homepage = evaluateHomepageCheck(homeRes);

  const score = robots.score + llms.score + homepage.score;
  let gradeLight = "red";
  let gradeLabel = "基礎缺口較大｜AI 目前很難準確讀懂你";
  if (score >= 80) {
    gradeLight = "green";
    gradeLabel = "基礎地基良好｜可進一步做 20 題跨平台 AI 實測";
  } else if (score >= 50) {
    gradeLight = "yellow";
    gradeLabel = "已有基礎骨架｜仍有明顯設定缺口待補齊";
  }

  const recommendations = [robots.recommendation, llms.recommendation, homepage.recommendation].filter(Boolean);
  if (recommendations.length === 0) {
    recommendations.push(
      "公開首頁的爬蟲放行、llms.txt 與基礎 Schema 皆已到位！下一步建議透過 20 題跨平台無痕實測，驗證 AI 實際回答有沒有點名你的品牌、說對價格與聯絡入口。"
    );
  }

  return {
    ok: true,
    target_url: targetUrlObj.href,
    origin,
    checked_at: new Date().toISOString(),
    elapsed_ms: Date.now() - startedAt,
    score,
    max_score: 100,
    grade_light: gradeLight,
    grade_label: gradeLabel,
    checks: {
      robots,
      llms,
      homepage,
    },
    recommendations,
    disclaimer: DISCLAIMER_TEXT,
    next_step: {
      line_id: "@250ruauk",
      line_url: "https://line.me/R/ti/p/@250ruauk",
      label: "加 LINE @250ruauk 預約完整 20 題與 9 維度健檢",
    },
  };
}

export async function onRequest(context) {
  const { request } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== "GET") {
    return jsonResponse(
      {
        ok: false,
        code: "METHOD_NOT_ALLOWED",
        error: "此端點僅支援 GET 與 OPTIONS 請求。",
      },
      405
    );
  }

  const reqUrl = new URL(request.url);
  const rawTarget = reqUrl.searchParams.get("url") || "";
  const validated = validatePublicUrl(rawTarget);
  if (!validated.ok) {
    return jsonResponse(
      {
        ok: false,
        code: validated.code,
        error: validated.error,
      },
      400
    );
  }

  const fetchFn = typeof context?.fetch === "function" ? context.fetch : globalThis.fetch;
  try {
    const report = await runGeoBasicCheck(validated.url, fetchFn);
    return jsonResponse(report, 200);
  } catch {
    return jsonResponse(
      {
        ok: false,
        code: "CHECK_FAILED",
        error: "檢測過程發生暫時性錯誤，請稍後再試。",
      },
      500
    );
  }
}
