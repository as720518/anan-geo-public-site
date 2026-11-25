/**
 * 阿男 GEO 實戰工坊 — 老闆一看就懂的超炫動態 HTML 簡報產生器
 * 純前端單檔 Blob 下載與雲端後台共用模組（零外部依賴、零 CDN、完全離線可用）
 *
 * 支援兩種模式：
 * 1. 單站健檢簡報（competitorReports 為空）
 * 2. 我方 vs 最多 4 家對手 PK 簡報（competitorReports 1～4 家）
 */

const MAX_PK_COMPETITORS = 4;
const LINE_ID = "@250ruauk";
const LINE_URL = "https://line.me/R/ti/p/@250ruauk";

const PALETTE = [
  { key: "self", stroke: "#e4b65c", fill: "rgba(228, 182, 92, 0.28)", solid: "#e4b65c" },
  { key: "rival1", stroke: "#34b399", fill: "rgba(52, 179, 153, 0.18)", solid: "#34b399" },
  { key: "rival2", stroke: "#5aa9ff", fill: "rgba(90, 169, 255, 0.18)", solid: "#5aa9ff" },
  { key: "rival3", stroke: "#b58dff", fill: "rgba(181, 141, 255, 0.18)", solid: "#b58dff" },
  { key: "rival4", stroke: "#f07c67", fill: "rgba(240, 124, 103, 0.18)", solid: "#f07c67" },
];

const BOT_LABELS = {
  Googlebot: "Google 搜尋",
  "OAI-SearchBot": "ChatGPT 搜尋",
  "ChatGPT-User": "ChatGPT 即時瀏覽",
  "Claude-SearchBot": "Claude 搜尋",
  PerplexityBot: "Perplexity 問答",
  DeepSeekBot: "DeepSeek 搜尋",
};

export function escapeHtml(val) {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeJsonForScript(data) {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function clampScore(val, max = 100) {
  const n = Number(val);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, Math.round(n)));
}

function hostFromUrl(urlStr) {
  try {
    return new URL(urlStr).hostname;
  } catch {
    return String(urlStr || "").replace(/^https?:\/\//i, "").split(/[/?#]/)[0] || "未命名網站";
  }
}

function formatReadableDate(isoStr) {
  if (!isoStr) return "即時檢測";
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return String(isoStr).slice(0, 16);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function lightFromPct(pct) {
  if (pct >= 80) return "green";
  if (pct >= 50) return "yellow";
  return "red";
}

function lightMeta(light) {
  if (light === "green") {
    return {
      light: "green",
      label: "綠燈・體質不錯",
      short: "綠燈",
      color: "#34b399",
      bg: "rgba(52, 179, 153, 0.16)",
      border: "rgba(52, 179, 153, 0.42)",
    };
  }
  if (light === "yellow") {
    return {
      light: "yellow",
      label: "黃燈・有缺口待補",
      short: "黃燈",
      color: "#e4b65c",
      bg: "rgba(228, 182, 92, 0.16)",
      border: "rgba(228, 182, 92, 0.44)",
    };
  }
  return {
    light: "red",
    label: "紅燈・正在流失客人",
    short: "紅燈",
    color: "#f07c67",
    bg: "rgba(240, 124, 103, 0.17)",
    border: "rgba(240, 124, 103, 0.46)",
  };
}

function verdictCopyForScore(score, light) {
  if (light === "green" || score >= 80) {
    return {
      headline: "底子打得很好，AI 已經看得懂你家在做什麼！",
      sub: "公開網站的開門設定、導覽資料與基本結構都已達標，接下來最適合直接實測 ChatGPT、Perplexity、Gemini 會不會優先點名你。",
    };
  }
  if (light === "yellow" || score >= 50) {
    return {
      headline: "有基本門面，但少做關鍵幾步，客人容易被同行帶走！",
      sub: "AI 看得到你一部分資料，但少了明確的導覽手冊或清楚的價目問答，遇到客人比價時容易被更齊全的對手搶單。",
    };
  }
  return {
    headline: "警報！現在 AI 幾乎讀不懂你家網站，正在默默流失精準客人",
    sub: "當客人直接問 ChatGPT「推薦哪一家？」時，你的網站可能連門都進不去，或 AI 找不到價格與聯絡方式，只好推薦隔壁同行。",
  };
}

/**
 * 將原始健檢 JSON 翻譯成 5 大老闆白話能力指標（100% 源自實測欄位，絕不捏造）
 */
export function evaluateBossDimensions(report) {
  const checks = report?.checks || {};
  const robots = checks.robots || {};
  const llms = checks.llms || {};
  const home = checks.homepage || {};

  // 1. AI 開門度（對應門牌開門）
  const robotsMax = Number(robots.max_score) || 35;
  const openDoorScore = clampScore(((Number(robots.score) || 0) / robotsMax) * 100);
  const allowedBots = Number.isFinite(robots.search_bots_allowed) ? robots.search_bots_allowed : null;
  const totalBots = Number(robots.search_bots_total) || 6;
  const trainSplit = Boolean(robots.training_distinguished);

  let openDoorStatus;
  if (robots.readable === false && openDoorScore === 0) {
    openDoorStatus = "目前無法正常打開你家網站的門口設定，AI 找資料小幫手可能連門都進不來。";
  } else if (robots.readable === false) {
    openDoorStatus = "網站門口沒有掛上清楚的「歡迎規則牌」，雖然沒直接關門，但沒把找客人的 AI 跟訓練模型分開管。";
  } else if (allowedBots === totalBots && trainSplit) {
    openDoorStatus = `6 大主流 AI 找資料入口全數開門放行，而且有把「推薦客人用」跟「拿去練模型」分開控管，表現滿分！`;
  } else if (allowedBots === totalBots) {
    openDoorStatus = `6 大主流 AI 找資料入口都能進門，建議再補上一行「區分找資料與抓去練模型」的規則就更完整。`;
  } else if (allowedBots > 0) {
    openDoorStatus = `6 大主流 AI 入口裡只開了 ${allowedBots} 扇門，其餘被擋在門外，客人用那幾家 AI 問問題時會漏掉你。`;
  } else {
    openDoorStatus = "網站大門把主流 AI 找資料入口全部關在外面，客人問 AI 時根本查不到你家資訊！";
  }

  const botPills = (Array.isArray(robots.search_bots) ? robots.search_bots : []).map((b) => ({
    label: BOT_LABELS[b.bot] || "主流 AI 搜尋",
    state: b.allowed === true ? "pass" : b.allowed === false ? "fail" : "warn",
    stateText: b.allowed === true ? "已開門" : b.allowed === false ? "被擋門" : "未設定",
  }));

  // 2. AI 導覽手冊
  const llmsMax = Number(llms.max_score) || 30;
  const guideScore = clampScore(((Number(llms.score) || 0) / llmsMax) * 100);
  let guideStatus;
  if (guideScore >= 80) {
    guideStatus = `已放好一份完整的「AI 專用導覽手冊」（約 ${Number(llms.content_length || 0).toLocaleString("en-US")} 字），AI 進門幾秒就能抓到主打服務與聯絡方式。`;
  } else if (guideScore >= 50) {
    guideStatus = "網站裡已經有放導覽手冊，但內容偏短或還沒列出主力服務連結，AI 看完還是只懂一半。";
  } else if (llms.is_html_misleading) {
    guideStatus = "AI 去翻導覽手冊時，網站卻把它導回普通網頁，等於給錯指南，AI 只好亂猜。";
  } else if (llms.robots_mismatch) {
    guideStatus = "門口告示牌說有導覽手冊，但 AI 走進去卻找不到檔案，設定前後兜不起來。";
  } else {
    guideStatus = "網站目前沒有放「AI 專用導覽手冊」，AI 進來只能自己到處翻網頁拼湊，很容易抓錯重點。";
  }

  const guidePills = [
    {
      label: "專屬純文字手冊存在",
      state: llms.valid_plain_text ? "pass" : "fail",
      stateText: llms.valid_plain_text ? "已放置" : "尚未建立",
    },
    {
      label: "有清楚標題與重點路線",
      state: llms.has_heading || llms.has_links_or_list ? "pass" : llms.valid_plain_text ? "warn" : "fail",
      stateText: llms.has_heading || llms.has_links_or_list ? "條理清楚" : "待補清單",
    },
  ];

  // 3. AI 數位名片
  const jsonLdCount = Number(home.json_ld_count) || 0;
  const schemaCount = Array.isArray(home.schema_types) ? home.schema_types.length : 0;
  const hasFaq = Boolean(home.has_faq_page);
  let cardScore = 0;
  if (jsonLdCount > 0) cardScore += 50;
  if (schemaCount >= 3) cardScore += 25;
  else if (schemaCount >= 1) cardScore += 10;
  if (hasFaq) cardScore += 25;
  cardScore = clampScore(cardScore);

  let cardStatus;
  if (cardScore >= 85) {
    cardStatus = "已備妥完整的「AI 數位名片」與「客人常見問答卡」，AI 一秒認得出你是正規在地品牌與主力項目。";
  } else if (cardScore >= 50) {
    cardStatus = hasFaq
      ? "已有基本數位名片，建議把服務項目與品牌資料串得更完整，讓 AI 更有把握推薦你。"
      : "有放基本數位名片，但少了「客人常見問答卡」，遇到細節提問時 AI 比較不敢直接引用你。";
  } else {
    cardStatus = "網站還沒放「AI 數位名片」，AI 看完首頁無法百分之百確認你的店名、服務分類與官方身分。";
  }

  const cardPills = [
    {
      label: "AI 數位名片已安裝",
      state: jsonLdCount > 0 ? "pass" : "fail",
      stateText: jsonLdCount > 0 ? "已安裝" : "完全缺少",
    },
    {
      label: "品牌與服務資訊齊全度",
      state: schemaCount >= 3 ? "pass" : schemaCount >= 1 ? "warn" : "fail",
      stateText: schemaCount >= 3 ? "資訊完整" : schemaCount >= 1 ? "僅有基本資料" : "待建立",
    },
    {
      label: "客人常見問答小卡",
      state: hasFaq ? "pass" : "fail",
      stateText: hasFaq ? "已建立" : "尚未建立",
    },
  ];

  // 4. 門面與招牌清楚度
  const hasTitle = Boolean(home.title);
  const hasBrokenDesc = Boolean(home.has_broken_description);
  const hasCleanDesc = Boolean(home.description) && !hasBrokenDesc;
  const hasCanonical = Boolean(home.canonical);
  const h1Count = Number(home.h1_count) || 0;
  const hasUniqueH1 = Boolean(home.has_unique_h1) || h1Count === 1;

  let storefrontScore = 0;
  if (hasTitle) storefrontScore += 25;
  if (hasCleanDesc) storefrontScore += 25;
  if (hasCanonical) storefrontScore += 25;
  if (hasUniqueH1) storefrontScore += 25;
  else if (h1Count > 1) storefrontScore += 10;
  storefrontScore = clampScore(storefrontScore);

  const missingFront = [];
  if (!hasTitle) missingFront.push("店面大招牌標題");
  if (hasBrokenDesc) missingFront.push("首頁簡介出現系統亂碼");
  else if (!hasCleanDesc) missingFront.push("一句話品牌簡介");
  if (!hasCanonical) missingFront.push("官方正版網址標記");
  if (h1Count === 0) missingFront.push("唯一首屏大主標");
  else if (h1Count > 1) missingFront.push(`首頁出現 ${h1Count} 個互相打架的大標題`);

  const storefrontStatus =
    missingFront.length === 0
      ? "大招牌、一句話簡介、官方正版門牌與首屏唯一主標全部清楚到位，AI 不會認錯店面。"
      : `門面仍有幾處讓 AI 霧煞煞的地方：${missingFront.join("、")}。`;

  const storefrontPills = [
    { label: "網站大招牌", state: hasTitle ? "pass" : "fail", stateText: hasTitle ? "清楚明確" : "缺少招牌" },
    {
      label: "一句話品牌簡介",
      state: hasCleanDesc ? "pass" : "fail",
      stateText: hasCleanDesc ? "正常好讀" : hasBrokenDesc ? "出現亂碼" : "尚未填寫",
    },
    { label: "官方正版門牌", state: hasCanonical ? "pass" : "warn", stateText: hasCanonical ? "已標明" : "未標明" },
    {
      label: "首屏唯一大主標",
      state: hasUniqueH1 ? "pass" : h1Count > 1 ? "warn" : "fail",
      stateText: hasUniqueH1 ? "聚焦唯一" : h1Count > 1 ? `重複 ${h1Count} 個` : "完全缺少",
    },
  ];

  // 5. 價目與問答抄寫力
  const homeOk = Number(home.http_status) >= 200 && Number(home.http_status) < 300;
  const hasTable = Boolean(home.has_visible_table);
  let pricingScore = 0;
  if (homeOk) pricingScore += 20;
  if (hasTable) pricingScore += 40;
  if (hasFaq) pricingScore += 30;
  if (hasUniqueH1) pricingScore += 10;
  pricingScore = clampScore(pricingScore);

  let pricingStatus;
  if (!homeOk) {
    pricingStatus = "首頁目前無法順利讀取，客人透過 AI 查價或問服務時會直接落空。";
  } else if (hasTable && hasFaq) {
    pricingStatus = "網頁裡有清楚的純文字價格／方案對照表與常見問答，客人一問費用，AI 能直接抄到正確答案！";
  } else if (hasTable) {
    pricingStatus = "已經有純文字對照表方便 AI 抄寫，但還沒補上標準常見問答，客人追問細節時答覆力道還差一點。";
  } else if (hasFaq) {
    pricingStatus = "有常見問答，但缺一張純文字方案價格比較表（如果只放圖片海報，AI 很難直接抄出價目）。";
  } else {
    pricingStatus = "首頁沒看到純文字的價格／方案對照表，也缺常見問答；如果價目只做成圖片海報，AI 幾乎抄不到答案！";
  }

  const pricingPills = [
    { label: "網頁順暢開啟", state: homeOk ? "pass" : "fail", stateText: homeOk ? "讀取正常" : "開啟異常" },
    {
      label: "純文字價格／方案表",
      state: hasTable ? "pass" : "fail",
      stateText: hasTable ? "AI 可直接抄寫" : "缺少純文字表",
    },
    { label: "客人常見問答區", state: hasFaq ? "pass" : "fail", stateText: hasFaq ? "已準備好答案" : "尚未設置" },
  ];

  return [
    {
      key: "open_door",
      shortLabel: "AI 開門度",
      question: "網站門牌有沒有對 AI 開門？",
      score: openDoorScore,
      light: lightFromPct(openDoorScore),
      status: openDoorStatus,
      whyLose:
        "越來越多客人消費前會先問 ChatGPT 或 Perplexity「哪一家比較好？」。如果網站大門把 AI 擋在外面，AI 連你的店名跟服務都讀不到，客人就會直接被介紹給隔壁有開門的同行。",
      quickFix:
        openDoorScore >= 95
          ? "已達到滿分標準，後續每次網站改版時記得維持開門規則即可。"
          : "請工程或網站維護人員更新網站門牌設定，明確對主流 AI 找資料入口開門，同時把「幫忙帶客」與「抓取訓練」分開管理。",
      pills: botPills.length > 0 ? botPills : [{ label: "門牌規則檔", state: openDoorScore >= 50 ? "warn" : "fail", stateText: openDoorScore >= 50 ? "預設放行待補規則" : "讀取受阻" }],
    },
    {
      key: "ai_guide",
      shortLabel: "AI 導覽手冊",
      question: "有沒有放一份 AI 專用導覽手冊？",
      score: guideScore,
      light: lightFromPct(guideScore),
      status: guideStatus,
      whyLose:
        "AI 回答客人的時間只有短短幾秒，不會像真人一樣慢慢逛完你整個網站。少了這份「AI 專用懶人包」，AI 很容易抓錯主打項目、甚至報出幾年前的舊價格，讓快成交的客人直接轉頭。",
      quickFix:
        guideScore >= 85
          ? "導覽手冊已上線！建議每季檢查一次裡面的主力方案、價格與官方聯絡方式是否最新。"
          : "在網站根目錄放一份一頁就能讀懂的「AI 專用導覽手冊」，寫清楚：你是誰、主打哪 3 項服務、價格區間、服務地區與官方聯絡入口。",
      pills: guidePills,
    },
    {
      key: "digital_card",
      shortLabel: "AI 數位名片",
      question: "有沒有給 AI 看的數位名片？",
      score: cardScore,
      light: lightFromPct(cardScore),
      status: cardStatus,
      whyLose:
        "就像跑業務見客戶沒遞名片一樣，網站少了給 AI 讀的「數位名片」，AI 不敢確定你是不是正規在地店家，推薦名單往往優先給名片寫得清清楚楚的競爭對手。",
      quickFix:
        cardScore >= 85
          ? "數位名片很完整！未來新增主力療程或產品時，同步補進數位名片即可。"
          : "幫首頁補上「AI 數位名片」，把品牌名稱、營業地區、主力服務項目、價格帶與客人常問的 5～8 個問題串成同一張官方名片。",
      pills: cardPills,
    },
    {
      key: "storefront",
      shortLabel: "招牌清楚度",
      question: "店面招牌和主打一句話，AI 看得懂嗎？",
      score: storefrontScore,
      light: lightFromPct(storefrontScore),
      status: storefrontStatus,
      whyLose:
        "如果店面招牌寫得太籠統、簡介出現亂碼，或一個畫面塞了好幾個互相打架的大標題，AI 搞不清楚你最拿手的是什麼，客人搜「地區＋需求」時你根本排不進推薦名單。",
      quickFix:
        storefrontScore >= 90
          ? "門面非常乾淨俐落！維持「一個頁面一個主打主題」就能長期加分。"
          : "把首頁招牌、一句話介紹、唯一大主標與官方正版網址整理乾淨，確保 AI 進來 1 秒就知道「你在哪裡、幫誰解決什麼問題」。",
      pills: storefrontPills,
    },
    {
      key: "pricing_answer",
      shortLabel: "價目抄寫力",
      question: "客人問價格，AI 抄得到答案嗎？",
      score: pricingScore,
      light: lightFromPct(pricingScore),
      status: pricingStatus,
      whyLose:
        "客人問 AI 最常問的就是「大概多少錢？方案差在哪？」。如果價目表只做成漂亮海報圖片、沒有純文字表格跟常見問答，AI 抄不到答案，就會直接推薦把價格寫得一清二楚的對手。",
      quickFix:
        pricingScore >= 90
          ? "價格與問答結構非常好抄！建議定期確認網頁文字與實際報價 100% 同步。"
          : "把主力服務的方案內容與價格區間做成「純文字對照表」（不要只放圖），再補 5 題客人最常問的實務問答，讓 AI 一抄就準。",
      pills: pricingPills,
    },
  ];
}

/**
 * 產出「優先先補這 3 件事」（永遠固定 3 張高影響力白話行動卡）
 */
function buildTop3Actions(dimensions, targetScore, pkContext) {
  const actions = [];
  const byKey = Object.fromEntries(dimensions.map((d) => [d.key, d]));

  const candidates = [
    {
      need: byKey.open_door.score < 85,
      weight: byKey.open_door.score === 0 ? 100 : 100 - byKey.open_door.score + 20,
      title: "先把網站大門對 6 大主流 AI 全部打開",
      detail:
        "把網站門口的進出規則調整好，讓 ChatGPT、Perplexity、Gemini、Claude 等找資料小幫手都能順暢進來，同時把「幫忙帶客人」跟「拿去練模型」分開控管。",
      impact: "先讓 AI 進得來，後面放的任何資料與價目才有機會被推薦出去。",
    },
    {
      need: byKey.ai_guide.score < 85,
      weight: 100 - byKey.ai_guide.score + 16,
      title: "幫網站放一份「AI 專用導覽手冊」",
      detail:
        "在網站最外層放一份精準的一頁式純文字懶人包，白紙黑字寫清楚品牌定位、主力方案、服務範圍、不承接的界線與官方聯絡管道。",
      impact: "AI 進站 3 秒就能抓住重點，大幅降低亂報價或認錯服務項目的機率。",
    },
    {
      need: byKey.pricing_answer.score < 85,
      weight: 100 - byKey.pricing_answer.score + 12,
      title: "把主力價格與常見問題做成「AI 一抄就準」的純文字表",
      detail:
        "把原本藏在圖片海報或散落在各頁的方案價格，整理成一張乾淨的純文字對照表，加上 5～8 題買家真實問答（費用、工期、售後保障）。",
      impact: "客人一問「多少錢、怎麼選」，AI 直接把你的方案跟聯絡方式端到客人面前。",
    },
    {
      need: byKey.digital_card.score < 85,
      weight: 100 - byKey.digital_card.score + 8,
      title: "幫官網補上完整的「AI 數位名片」",
      detail:
        "在首頁背後補齊給 AI 讀的正式數位名片，串起店名、地區、主力服務與常見問答，而且內容與網頁上人眼看到的文字完全一致。",
      impact: "建立正規品牌信任度，讓 AI 推薦在地優質店家時敢把你排在前面。",
    },
    {
      need: byKey.storefront.score < 85,
      weight: 100 - byKey.storefront.score + 4,
      title: "整理門面招牌、簡介與唯一主標，讓 AI 一眼懂你",
      detail:
        "檢查並補齊網站大招牌、正常不亂碼的一句話簡介、唯一首屏大標題與官方正版網址標記，避免系統亂碼或多個標題打架。",
      impact: "消除 AI 誤判，讓客人搜尋地區＋核心服務時更容易對應到你家官網。",
    },
  ];

  const needed = candidates.filter((c) => c.need).sort((a, b) => b.weight - a.weight);
  for (const item of needed.slice(0, 3)) {
    actions.push(item);
  }

  // 若體質已相當優秀，補上進階搶客步驟湊滿 3 件
  const advancedFallbacks = [
    {
      title: "執行 20 題跨平台無痕實測，確認 AI 真的點名你",
      detail:
        "網站地基已經打得很穩！下一步用真實客人的口吻，在 ChatGPT、Perplexity、Gemini 無痕新對話實測 20 個買家提問，抓出實際曝光率與有沒有報錯舊資訊。",
      impact: pkContext?.hasCompetitors
        ? "直接確認你在 AI 嘴裡的真實勝率，把體質分數變成真正的進單數。"
        : "從「網站準備好」跨進「AI 真的會推薦你」，每筆改善都有前後數據對照。",
    },
    {
      title: "清查網路舊頁面與第三方平台，杜絕 AI 報錯舊價格",
      detail:
        "很多老闆官網改好了，但 AI 卻抓到幾年前的新聞稿、舊部落格或舊目錄上的過期價格。盤點站外舊資料並統一最新口徑，避免客人拿舊價來問。",
      impact: "讓客人從 AI 導流過來時對價格與流程零落差，成交溝通省一半力氣。",
    },
    {
      title: "建立每月固定更新的實戰案例與在地口碑專頁",
      detail:
        "定期新增真實服務案例、客人常踩的坑與地區專屬說明，讓 AI 每次回來巡視都能看到你持續活躍且專業度領先同行。",
      impact: "長期拉開與同業的差距，讓對手想追也追不上。",
    },
  ];

  let fbIdx = 0;
  while (actions.length < 3 && fbIdx < advancedFallbacks.length) {
    actions.push(advancedFallbacks[fbIdx]);
    fbIdx += 1;
  }

  const badges = [
    { label: "第 1 優先・馬上先補", cls: "prio-1" },
    { label: "第 2 優先・強烈建議", cls: "prio-2" },
    { label: "第 3 優先・拉開差距", cls: "prio-3" },
  ];

  return actions.slice(0, 3).map((act, idx) => ({
    rank: idx + 1,
    badge: badges[idx].label,
    badgeClass: badges[idx].cls,
    title: act.title,
    detail: act.detail,
    impact: act.impact,
  }));
}

function buildRadarGeometry(scores, cx = 200, cy = 166, maxR = 94) {
  const n = scores.length;
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const ratio = Math.max(0.08, Math.min(1, (Number(scores[i]) || 0) / 100));
    const r = ratio * maxR;
    pts.push({
      x: Number((cx + r * Math.cos(angle)).toFixed(1)),
      y: Number((cy + r * Math.sin(angle)).toFixed(1)),
      ax: Number((cx + maxR * Math.cos(angle)).toFixed(1)),
      ay: Number((cy + maxR * Math.sin(angle)).toFixed(1)),
      lx: Number((cx + (maxR + 22) * Math.cos(angle)).toFixed(1)),
      ly: Number((cy + (maxR + 20) * Math.sin(angle)).toFixed(1)),
    });
  }
  return pts;
}

function radarPolygonPoints(scores, cx = 200, cy = 166, maxR = 94) {
  return buildRadarGeometry(scores, cx, cy, maxR)
    .map((p) => `${p.x},${p.y}`)
    .join(" ");
}

function buildRadarGridSvg(dimensions, targetSeries, competitorSeries) {
  const cx = 200;
  const cy = 166;
  const maxR = 94;
  const levels = [20, 40, 60, 80, 100];

  const ringsSvg = levels
    .map((lv) => {
      const pts = radarPolygonPoints(dimensions.map(() => lv), cx, cy, maxR);
      return `<polygon points="${pts}" class="radar-grid-ring" />`;
    })
    .join("");

  const fullPts = buildRadarGeometry(dimensions.map(() => 100), cx, cy, maxR);
  const spokesSvg = fullPts
    .map((p) => `<line x1="${cx}" y1="${cy}" x2="${p.ax}" y2="${p.ay}" class="radar-spoke" />`)
    .join("");

  const labelAnchor = ["middle", "start", "start", "end", "end"];
  const labelDy = [-6, 4, 14, 14, 4];
  const labelDx = [0, 4, 2, -2, -4];

  const labelsSvg = dimensions
    .map((dim, idx) => {
      const p = fullPts[idx];
      const lx = Number((p.lx + labelDx[idx]).toFixed(1));
      const ly = Number((p.ly + labelDy[idx]).toFixed(1));
      return `
        <g class="radar-label-btn" data-dim-key="${escapeHtml(dim.key)}" tabindex="0" role="button" aria-label="查看${escapeHtml(dim.shortLabel)}白話解說">
          <text x="${lx}" y="${ly}" text-anchor="${labelAnchor[idx]}" class="radar-axis-label">${escapeHtml(dim.shortLabel)}</text>
          <text x="${lx}" y="${ly + 14}" text-anchor="${labelAnchor[idx]}" class="radar-axis-score">${dim.score}%</text>
        </g>`;
    })
    .join("");

  const compPolysSvg = competitorSeries
    .map((comp) => {
      const pts = radarPolygonPoints(comp.scores, cx, cy, maxR);
      return `<polygon points="${pts}" class="radar-poly-comp" data-series-id="${escapeHtml(comp.id)}" fill="${comp.fill}" stroke="${comp.stroke}" stroke-width="2" stroke-dasharray="5 4" />`;
    })
    .join("");

  const selfPts = buildRadarGeometry(targetSeries.scores, cx, cy, maxR);
  const selfPolyPts = selfPts.map((p) => `${p.x},${p.y}`).join(" ");
  const selfDotsSvg = selfPts
    .map((p, idx) => {
      const dim = dimensions[idx];
      return `
        <g class="radar-dot-wrap${idx === 0 ? " is-active" : ""}" data-dim-key="${escapeHtml(dim.key)}" tabindex="0" role="button" aria-label="${escapeHtml(dim.shortLabel)} ${dim.score}%">
          <circle cx="${p.x}" cy="${p.y}" r="14" fill="transparent" />
          <circle cx="${p.x}" cy="${p.y}" r="5.5" class="radar-dot" />
        </g>`;
    })
    .join("");

  return `
    <svg id="radar-svg" class="radar-svg" viewBox="0 0 400 330" role="img" aria-label="五大 AI 獲客能力互動雷達圖">
      <defs>
        <radialGradient id="selfRadarGrad" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stop-color="#f2cf7e" stop-opacity="0.46" />
          <stop offset="100%" stop-color="#d9a74a" stop-opacity="0.16" />
        </radialGradient>
      </defs>
      ${ringsSvg}
      ${spokesSvg}
      ${compPolysSvg}
      <polygon id="radar-self-poly" points="${selfPolyPts}" fill="url(#selfRadarGrad)" stroke="#e4b65c" stroke-width="2.6" class="radar-poly-self" />
      ${selfDotsSvg}
      ${labelsSvg}
    </svg>`;
}

export function buildBossReportFilename({ clientName, targetUrl, competitorCount = 0, generatedAt } = {}) {
  const host = hostFromUrl(targetUrl || clientName || "site");
  const slug = host.replace(/[^a-z0-9.-]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "site";
  const datePart = String(generatedAt || new Date().toISOString()).slice(0, 10);
  const modeTag = competitorCount > 0 ? `pk-${Math.min(MAX_PK_COMPETITORS, competitorCount)}rivals` : "single";
  return `geo-boss-brief-${slug}-${modeTag}-${datePart}.html`;
}

export function buildBossReportHtml({
  clientName = "",
  targetReport = {},
  competitorReports = [],
  notes = "",
  generatedAt = new Date().toISOString(),
} = {}) {
  const targetUrl = String(targetReport.target_url || "");
  const displayName = String(clientName || targetReport.display_name || hostFromUrl(targetUrl)).trim() || "客戶網站";
  const targetScore = clampScore(targetReport.score ?? 0);
  const targetLight = targetReport.grade_light || lightFromPct(targetScore);
  const tMeta = lightMeta(targetLight);
  const verdict = verdictCopyForScore(targetScore, targetLight);
  const readableTime = formatReadableDate(generatedAt);

  const dimensions = evaluateBossDimensions(targetReport);
  const cleanComps = (Array.isArray(competitorReports) ? competitorReports : [])
    .filter((c) => c && typeof c === "object" && (c.target_url || c.score != null))
    .slice(0, MAX_PK_COMPETITORS);

  const isPkMode = cleanComps.length > 0;

  const targetSeries = {
    id: "self",
    isSelf: true,
    name: displayName,
    host: hostFromUrl(targetUrl),
    url: targetUrl,
    score: targetScore,
    light: targetLight,
    stroke: PALETTE[0].stroke,
    fill: PALETTE[0].fill,
    solid: PALETTE[0].solid,
    scores: dimensions.map((d) => d.score),
    dimensions,
  };

  const competitorSeries = cleanComps.map((comp, idx) => {
    const pal = PALETTE[idx + 1] || PALETTE[1];
    const cDims = evaluateBossDimensions(comp);
    const cUrl = String(comp.target_url || "");
    const cHost = hostFromUrl(cUrl);
    const cName = String(comp.display_name || comp.title || cHost).trim() || cHost;
    const cScore = clampScore(comp.score ?? 0);
    return {
      id: `rival-${idx + 1}`,
      isSelf: false,
      name: cName,
      host: cHost,
      url: cUrl,
      score: cScore,
      diff: targetScore - cScore,
      light: comp.grade_light || lightFromPct(cScore),
      stroke: pal.stroke,
      fill: pal.fill,
      solid: pal.solid,
      scores: cDims.map((d) => d.score),
      dimensions: cDims,
    };
  });

  // 計算 PK 排名
  const rankedAll = [targetSeries, ...competitorSeries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.isSelf ? -1 : b.isSelf ? 1 : 0;
  });
  const selfRank = rankedAll.findIndex((item) => item.isSelf) + 1;
  const bestRival = competitorSeries.length > 0
    ? [...competitorSeries].sort((a, b) => b.score - a.score)[0]
    : null;

  const top3Actions = buildTop3Actions(dimensions, targetScore, {
    hasCompetitors: isPkMode,
    selfRank,
    totalCount: rankedAll.length,
  });

  const radarSvg = buildRadarGridSvg(dimensions, targetSeries, competitorSeries);

  // 雷達圖圖例切換鈕（PK 模式顯示我方＋對手；單站模式顯示 5 個快選能力標籤）
  const radarLegendHtml = isPkMode
    ? `<div class="radar-legend" role="group" aria-label="切換對手雷達圖疊加">
        <span class="legend-chip is-self">
          <i class="dot" style="background:${targetSeries.solid};"></i>
          <span>${escapeHtml(displayName)}（我方 ${targetScore}分）</span>
        </span>
        ${competitorSeries
          .map(
            (c) => `
          <button type="button" class="legend-chip is-on" data-radar-toggle="${escapeHtml(c.id)}" aria-pressed="true">
            <i class="dot" style="background:${c.solid};"></i>
            <span>${escapeHtml(c.name)}（${c.score}分）</span>
          </button>`
          )
          .join("")}
      </div>`
    : `<div class="radar-legend" role="group" aria-label="點選五大能力查看白話解說">
        ${dimensions
          .map(
            (d, i) => `
          <button type="button" class="legend-chip${i === 0 ? " is-selected" : ""}" data-dim-key="${escapeHtml(d.key)}">
            <i class="dot" style="background:${lightMeta(d.light).color};"></i>
            <span>${escapeHtml(d.shortLabel)} ${d.score}%</span>
          </button>`
          )
          .join("")}
      </div>`;

  // PK 彩色橫條對比圖 或 單站基準對比條
  const pkSectionHtml = isPkMode
    ? `
      <section class="section card">
        <div class="section-head">
          <div>
            <p class="sec-kicker">COMPETITOR PK</p>
            <h2>同業 PK 戰力對比（我方 vs ${competitorSeries.length} 家同行）</h2>
          </div>
          <span class="rank-pill">目前第 ${selfRank} / ${rankedAll.length} 名</span>
        </div>
        <p class="sec-sub">點一下任一家同行橫條，立刻展開「我方 vs 這家對手」的 5 項白話勝負明細。</p>
        <div class="pk-bars">
          ${rankedAll
            .map((entry, idx) => {
              const medal = idx === 0 ? "第 1 名" : idx === 1 ? "第 2 名" : idx === 2 ? "第 3 名" : `第 ${idx + 1} 名`;
              const diff = targetScore - entry.score;
              let diffLabel = "我方基準";
              let diffCls = "diff-self";
              if (!entry.isSelf) {
                if (diff > 0) {
                  diffLabel = `我方領先 +${diff} 分`;
                  diffCls = "diff-win";
                } else if (diff < 0) {
                  diffLabel = `落後對手 ${Math.abs(diff)} 分`;
                  diffCls = "diff-lose";
                } else {
                  diffLabel = "與對手平手";
                  diffCls = "diff-tie";
                }
              }
              return `
                <button type="button" class="pk-row${entry.isSelf ? " is-self" : ""}" data-pk-bar="${escapeHtml(entry.id)}" aria-expanded="false">
                  <div class="pk-row-top">
                    <div class="pk-name-wrap">
                      <span class="pk-medal">${medal}</span>
                      <span class="pk-name">${escapeHtml(entry.name)}</span>
                      ${entry.isSelf ? '<span class="self-tag">我方網站</span>' : ""}
                    </div>
                    <div class="pk-score-wrap">
                      <strong class="mono">${entry.score}<span>/100</span></strong>
                      <span class="diff-pill ${diffCls}">${escapeHtml(diffLabel)}</span>
                    </div>
                  </div>
                  <div class="pk-track">
                    <div class="pk-fill" data-bar-target="${entry.score}" style="width:${entry.score}%;background:linear-gradient(90deg, ${entry.solid}, ${entry.solid}cc);"></div>
                  </div>
                  <div class="pk-host mono">${escapeHtml(entry.host)}</div>
                </button>`;
            })
            .join("")}
        </div>
        <div id="pk-compare-drawer" class="pk-drawer" hidden>
          <div class="pk-drawer-head">
            <strong id="pk-drawer-title">逐項白話勝負拆解</strong>
            <span id="pk-drawer-badge" class="pill-mini">點擊比較</span>
          </div>
          <div id="pk-drawer-list" class="pk-drawer-list"></div>
        </div>
      </section>`
    : `
      <section class="section card">
        <div class="section-head">
          <div>
            <p class="sec-kicker">BENCHMARK</p>
            <h2>你的位置：對照阿男實戰改造前後基準</h2>
          </div>
          <span class="rank-pill">1,298 筆實測參考</span>
        </div>
        <p class="sec-sub">對照實際品牌官網改造前（41 分）與改造後（89 分）的公開實測基準，一眼看出目前距離「AI 主動推薦體質」還有多遠。</p>
        <div class="pk-bars">
          <div class="pk-row is-self" data-pk-bar="self">
            <div class="pk-row-top">
              <div class="pk-name-wrap">
                <span class="self-tag">我方目前</span>
                <span class="pk-name">${escapeHtml(displayName)}</span>
              </div>
              <div class="pk-score-wrap">
                <strong class="mono">${targetScore}<span>/100</span></strong>
                <span class="diff-pill" style="background:${tMeta.bg};color:${tMeta.color};">${escapeHtml(tMeta.short)}</span>
              </div>
            </div>
            <div class="pk-track">
              <div class="pk-fill" data-bar-target="${targetScore}" style="width:${targetScore}%;background:linear-gradient(90deg, ${tMeta.color}, #e4b65c);"></div>
            </div>
          </div>
          <div class="pk-row is-static" data-pk-bar="ref-after">
            <div class="pk-row-top">
              <div class="pk-name-wrap">
                <span class="pk-medal">實戰標竿</span>
                <span class="pk-name">改造完成後基準（自然曝光顯著提升）</span>
              </div>
              <div class="pk-score-wrap">
                <strong class="mono">89<span>/100</span></strong>
                <span class="diff-pill diff-win">綠燈標竿</span>
              </div>
            </div>
            <div class="pk-track">
              <div class="pk-fill" data-bar-target="89" style="width:89%;background:linear-gradient(90deg, #34b399, #57d6bb);"></div>
            </div>
          </div>
          <div class="pk-row is-static" data-pk-bar="ref-before">
            <div class="pk-row-top">
              <div class="pk-name-wrap">
                <span class="pk-medal">改造前</span>
                <span class="pk-name">一般未調整官網常見起點</span>
              </div>
              <div class="pk-score-wrap">
                <strong class="mono">41<span>/100</span></strong>
                <span class="diff-pill diff-lose">常見紅燈</span>
              </div>
            </div>
            <div class="pk-track">
              <div class="pk-fill" data-bar-target="41" style="width:41%;background:linear-gradient(90deg, #f07c67, #e48f67);"></div>
            </div>
          </div>
        </div>
      </section>`;

  // 5 大老闆白話體檢卡片
  const dimCardsHtml = dimensions
    .map((dim, idx) => {
      const m = lightMeta(dim.light);
      const isOpen = idx === 0;
      return `
        <article class="dim-card${isOpen ? " is-expanded" : ""}" data-dim-card="${escapeHtml(dim.key)}" data-dim-key="${escapeHtml(dim.key)}">
          <button type="button" class="dim-card-trigger" aria-expanded="${isOpen ? "true" : "false"}">
            <div class="dim-card-top">
              <div class="dim-q-wrap">
                <span class="dim-num">0${idx + 1}</span>
                <h3>${escapeHtml(dim.question)}</h3>
              </div>
              <span class="pill" style="background:${m.bg};color:${m.color};border-color:${m.border};">${escapeHtml(m.short)}・${dim.score}%</span>
            </div>
            <div class="dim-bar-track">
              <div class="dim-bar-fill" data-bar-target="${dim.score}" style="width:${dim.score}%;background:${m.color};"></div>
            </div>
            <p class="dim-status">${escapeHtml(dim.status)}</p>
            <span class="dim-toggle-hint">${isOpen ? "收起詳細說明 ▲" : "點我看：為什麼會少賺客人 ▼"}</span>
          </button>
          <div class="dim-body"${isOpen ? "" : " hidden"}>
            <div class="why-lose-box">
              <div class="why-lose-title">為什麼會少賺客人？</div>
              <p>${escapeHtml(dim.whyLose)}</p>
            </div>
            <div class="quick-fix-box">
              <div class="quick-fix-title">白話補強做法</div>
              <p>${escapeHtml(dim.quickFix)}</p>
            </div>
            <div class="pill-grid">
              ${dim.pills
                .map(
                  (p) => `
                <div class="status-chip chip-${escapeHtml(p.state)}">
                  <span class="chip-name">${escapeHtml(p.label)}</span>
                  <strong>${escapeHtml(p.stateText)}</strong>
                </div>`
                )
                .join("")}
            </div>
          </div>
        </article>`;
    })
    .join("");

  // 優先先補這 3 件事
  const top3Html = top3Actions
    .map(
      (act) => `
        <article class="action-card">
          <div class="action-head">
            <span class="action-num mono">0${act.rank}</span>
            <span class="prio-badge ${escapeHtml(act.badgeClass)}">${escapeHtml(act.badge)}</span>
          </div>
          <h3>${escapeHtml(act.title)}</h3>
          <p class="action-detail">${escapeHtml(act.detail)}</p>
          <div class="action-impact"><strong>做了會有什麼感：</strong>${escapeHtml(act.impact)}</div>
        </article>`
    )
    .join("");

  // Hero 狀態摘要徽章（PK 模式補充與最強對手比較）
  const pkHeroBadgeHtml = isPkMode && bestRival
    ? `<div class="hero-pk-strip">
        <span class="hero-pk-rank">同業 PK 第 <strong>${selfRank}</strong> / ${rankedAll.length} 名</span>
        <span class="hero-pk-gap">${
          targetScore > bestRival.score
            ? `領先最強對手（${escapeHtml(bestRival.name)}）+${targetScore - bestRival.score} 分`
            : targetScore < bestRival.score
              ? `落後最強對手（${escapeHtml(bestRival.name)}）${bestRival.score - targetScore} 分`
              : `與最強對手（${escapeHtml(bestRival.name)}）同分平手`
        }</span>
      </div>`
    : "";

  const notesHtml = notes
    ? `<div class="note-box"><strong>現場討論備註：</strong>${escapeHtml(notes)}</div>`
    : "";

  // 供前端互動腳本使用的安全 JSON（已完全轉義 < > &）
  const embeddedPayload = {
    mode: isPkMode ? "pk" : "single",
    targetScore,
    self: {
      id: targetSeries.id,
      name: targetSeries.name,
      host: targetSeries.host,
      score: targetSeries.score,
      scores: targetSeries.scores,
    },
    dimensions: dimensions.map((d) => ({
      key: d.key,
      shortLabel: d.shortLabel,
      question: d.question,
      score: d.score,
      light: d.light,
      lightLabel: lightMeta(d.light).short,
      color: lightMeta(d.light).color,
      status: d.status,
      whyLose: d.whyLose,
      quickFix: d.quickFix,
    })),
    competitors: competitorSeries.map((c) => ({
      id: c.id,
      name: c.name,
      host: c.host,
      score: c.score,
      diff: c.diff,
      solid: c.solid,
      scores: c.scores,
    })),
  };

  const firstDim = dimensions[0];
  const firstMeta = lightMeta(firstDim.light);
  const ringRadius = 64;
  const ringCircumference = Number((2 * Math.PI * ringRadius).toFixed(2));
  const finalOffset = Number((ringCircumference * (1 - targetScore / 100)).toFixed(2));

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="robots" content="noindex, nofollow">
  <title>${escapeHtml(displayName)}｜AI 獲客體質健檢簡報${isPkMode ? "（含同業 PK）" : ""}</title>
  <style>
    :root {
      --bg: #080d14;
      --bg-card: #101925;
      --bg-elev: #162333;
      --border: #25364a;
      --border-strong: #37506c;
      --ink: #eef3f8;
      --ink-sub: #a7bacd;
      --ink-muted: #7e95ab;
      --brass: #e4b65c;
      --brass-soft: rgba(228, 182, 92, 0.16);
      --green: #34b399;
      --green-soft: rgba(52, 179, 153, 0.16);
      --red: #f07c67;
      --red-soft: rgba(240, 124, 103, 0.16);
      --radius-lg: 22px;
      --radius-md: 16px;
      --radius-sm: 12px;
    }

    *, *::before, *::after { box-sizing: border-box; }
    [hidden] { display: none !important; }

    html {
      background: var(--bg);
      color: var(--ink);
      -webkit-text-size-adjust: 100%;
      overflow-x: clip;
    }

    body {
      margin: 0;
      padding: 18px 14px 56px;
      font-family: "PingFang TC", "Hiragino Sans CNS", "Noto Sans TC", "Microsoft JhengHei", system-ui, -apple-system, sans-serif;
      font-size: 15px;
      line-height: 1.65;
      color: var(--ink);
      background:
        radial-gradient(circle at 15% 0%, rgba(228, 182, 92, 0.14), transparent 42%),
        radial-gradient(circle at 88% 8%, rgba(52, 179, 153, 0.12), transparent 38%),
        var(--bg);
      overflow-x: clip;
      -webkit-font-smoothing: antialiased;
    }

    .mono {
      font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-variant-numeric: tabular-nums;
    }

    button {
      font: inherit;
      color: inherit;
      cursor: pointer;
      touch-action: manipulation;
    }

    .wrap {
      width: 100%;
      max-width: 920px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    /* ==================== Hero 儀表板 ==================== */
    .hero {
      position: relative;
      background: linear-gradient(155deg, #142130 0%, #0d151f 100%);
      border: 1px solid var(--border-strong);
      border-top: 4px solid var(--brass);
      border-radius: var(--radius-lg);
      padding: 22px 18px;
      box-shadow: 0 22px 60px rgba(0, 0, 0, 0.45);
      overflow: hidden;
    }

    .hero-top-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 12px;
    }

    .eyebrow {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: var(--brass);
    }

    .mode-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      background: var(--brass-soft);
      border: 1px solid rgba(228, 182, 92, 0.42);
      color: #f8de9d;
      font-size: 12px;
      font-weight: 700;
    }

    h1 {
      margin: 0 0 6px;
      font-size: clamp(22px, 5vw, 32px);
      line-height: 1.28;
      font-weight: 900;
      letter-spacing: -0.01em;
      overflow-wrap: anywhere;
    }

    .hero-meta {
      font-size: 13px;
      color: var(--ink-muted);
      display: flex;
      flex-wrap: wrap;
      gap: 4px 14px;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .hero-dashboard {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid var(--border);
      display: grid;
      grid-template-columns: 1fr;
      gap: 18px;
      align-items: center;
    }

    .ring-box {
      position: relative;
      width: 164px;
      height: 164px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .ring-svg {
      width: 164px;
      height: 164px;
      transform: rotate(-90deg);
      filter: drop-shadow(0 0 18px ${tMeta.bg});
    }

    .ring-track {
      fill: none;
      stroke: #1d2c3d;
      stroke-width: 12;
    }

    .ring-progress {
      fill: none;
      stroke: ${tMeta.color};
      stroke-width: 12;
      stroke-linecap: round;
    }

    .ring-center {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }

    .ring-num {
      font-size: 46px;
      font-weight: 900;
      line-height: 1;
      color: #ffffff;
    }

    .ring-denom {
      margin-top: 4px;
      font-size: 12px;
      font-weight: 700;
      color: var(--ink-muted);
      letter-spacing: 0.04em;
    }

    .verdict-box {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .traffic-wrap {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }

    .traffic-light {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 6px 11px;
      border-radius: 999px;
      background: #0a1018;
      border: 1px solid var(--border-strong);
    }

    .lamp {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      opacity: 0.22;
      transition: transform 0.25s ease, opacity 0.25s ease;
    }

    .lamp-red { background: #f07c67; }
    .lamp-yellow { background: #e4b65c; }
    .lamp-green { background: #34b399; }

    .lamp.is-lit {
      opacity: 1;
      transform: scale(1.18);
      animation: lampPulse 2.2s ease-in-out infinite;
    }

    .lamp-red.is-lit { box-shadow: 0 0 12px rgba(240, 124, 103, 0.9); }
    .lamp-yellow.is-lit { box-shadow: 0 0 12px rgba(228, 182, 92, 0.9); }
    .lamp-green.is-lit { box-shadow: 0 0 12px rgba(52, 179, 153, 0.9); }

    @keyframes lampPulse {
      0%, 100% { filter: brightness(1); }
      50% { filter: brightness(1.3); }
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      padding: 5px 12px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 800;
      border: 1px solid transparent;
    }

    .verdict-headline {
      margin: 0;
      font-size: clamp(18px, 3.8vw, 22px);
      line-height: 1.38;
      font-weight: 800;
      color: #ffffff;
    }

    .verdict-sub {
      margin: 0;
      font-size: 14px;
      color: var(--ink-sub);
    }

    .hero-pk-strip {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 14px;
      padding: 10px 13px;
      border-radius: var(--radius-sm);
      background: rgba(228, 182, 92, 0.11);
      border: 1px solid rgba(228, 182, 92, 0.34);
      font-size: 13.5px;
      color: #f8e2ae;
    }

    .hero-pk-rank {
      font-weight: 800;
      color: #ffffff;
    }

    .note-box {
      margin-top: 14px;
      padding: 12px 14px;
      border-radius: var(--radius-sm);
      background: rgba(52, 179, 153, 0.11);
      border: 1px solid rgba(52, 179, 153, 0.34);
      font-size: 13.5px;
      color: #d6f5ed;
      overflow-wrap: anywhere;
    }

    /* ==================== 共用卡片區塊 ==================== */
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 20px 16px;
    }

    .section-head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px 12px;
      margin-bottom: 6px;
    }

    .sec-kicker {
      margin: 0 0 2px;
      font-family: ui-monospace, "SF Mono", Menlo, monospace;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      color: var(--brass);
    }

    h2 {
      margin: 0;
      font-size: clamp(18px, 4vw, 22px);
      font-weight: 800;
      line-height: 1.32;
      color: #ffffff;
    }

    .sec-sub {
      margin: 4px 0 16px;
      font-size: 13.5px;
      color: var(--ink-sub);
    }

    .rank-pill {
      display: inline-flex;
      align-items: center;
      padding: 4px 11px;
      border-radius: 999px;
      background: var(--bg-elev);
      border: 1px solid var(--border-strong);
      font-size: 12px;
      font-weight: 700;
      color: var(--brass);
      white-space: nowrap;
    }

    /* ==================== 互動 SVG 雷達圖 ==================== */
    .radar-layout {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
      align-items: center;
    }

    .radar-stage {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .radar-svg {
      width: 100%;
      max-width: 380px;
      height: auto;
      display: block;
    }

    .radar-grid-ring {
      fill: none;
      stroke: rgba(167, 186, 205, 0.16);
      stroke-width: 1;
    }

    .radar-spoke {
      stroke: rgba(167, 186, 205, 0.18);
      stroke-width: 1;
    }

    .radar-poly-self {
      transition: opacity 0.25s ease;
      transform-origin: 200px 166px;
      animation: radarPop 0.75s cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    .radar-poly-comp {
      transition: opacity 0.25s ease;
      transform-origin: 200px 166px;
      animation: radarPop 0.85s cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    .radar-poly-comp.is-hidden {
      opacity: 0;
      pointer-events: none;
    }

    @keyframes radarPop {
      from { transform: scale(0.25); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    .radar-dot-wrap { cursor: pointer; outline: none; }
    .radar-dot {
      fill: #080d14;
      stroke: #e4b65c;
      stroke-width: 2.8;
      transition: r 0.18s ease, fill 0.18s ease;
    }
    .radar-dot-wrap.is-active .radar-dot,
    .radar-dot-wrap:hover .radar-dot {
      fill: #e4b65c;
      r: 7.5;
    }

    .radar-label-btn { cursor: pointer; outline: none; }
    .radar-axis-label {
      fill: #dce7f2;
      font-size: 12px;
      font-weight: 700;
    }
    .radar-axis-score {
      fill: #e4b65c;
      font-size: 11px;
      font-weight: 800;
      font-family: ui-monospace, "SF Mono", Menlo, monospace;
    }

    .radar-legend {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 7px;
      width: 100%;
    }

    .legend-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 999px;
      background: var(--bg-elev);
      border: 1px solid var(--border);
      font-size: 12px;
      font-weight: 700;
      color: var(--ink-sub);
      transition: border-color 0.15s ease, background 0.15s ease, opacity 0.15s ease;
      max-width: 100%;
    }

    .legend-chip span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 210px;
    }

    .legend-chip .dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .legend-chip.is-self,
    .legend-chip.is-selected,
    .legend-chip.is-on {
      border-color: var(--border-strong);
      color: #ffffff;
    }

    .legend-chip.is-off {
      opacity: 0.42;
    }

    .insight-panel {
      background: var(--bg-elev);
      border: 1px solid var(--border-strong);
      border-left: 4px solid var(--brass);
      border-radius: var(--radius-md);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 0;
    }

    .insight-top {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .insight-tag {
      font-size: 11.5px;
      font-weight: 800;
      color: var(--brass);
      letter-spacing: 0.04em;
    }

    .insight-q {
      margin: 0;
      font-size: 17px;
      font-weight: 800;
      color: #ffffff;
    }

    .insight-status {
      margin: 0;
      font-size: 14px;
      color: var(--ink);
    }

    .insight-why {
      padding: 11px 12px;
      border-radius: var(--radius-sm);
      background: rgba(240, 124, 103, 0.11);
      border: 1px solid rgba(240, 124, 103, 0.3);
      font-size: 13.5px;
      color: #ffd8d0;
    }

    .insight-why strong {
      display: block;
      margin-bottom: 3px;
      color: #ff9d8a;
      font-size: 12.5px;
    }

    .insight-fix {
      font-size: 13.5px;
      color: #d8f4ec;
      margin: 0;
    }

    /* ==================== 彩色橫條 PK 對比圖 ==================== */
    .pk-bars {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .pk-row {
      width: 100%;
      text-align: left;
      background: var(--bg-elev);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 13px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      transition: border-color 0.16s ease, transform 0.12s ease;
    }

    button.pk-row:hover {
      border-color: var(--brass);
    }

    .pk-row.is-self {
      border-color: rgba(228, 182, 92, 0.72);
      background: linear-gradient(135deg, rgba(228, 182, 92, 0.13), var(--bg-elev) 70%);
    }

    .pk-row.is-active {
      border-color: var(--green);
      box-shadow: 0 0 0 2px rgba(52, 179, 153, 0.2);
    }

    .pk-row-top {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 6px 10px;
    }

    .pk-name-wrap {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 8px;
      min-width: 0;
    }

    .pk-medal {
      font-size: 11px;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      color: var(--ink-sub);
      white-space: nowrap;
    }

    .self-tag {
      font-size: 11px;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--brass);
      color: #080d14;
      white-space: nowrap;
    }

    .pk-name {
      font-size: 15px;
      font-weight: 800;
      color: #ffffff;
      overflow-wrap: anywhere;
    }

    .pk-score-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .pk-score-wrap strong {
      font-size: 18px;
      color: #ffffff;
    }

    .pk-score-wrap strong span {
      font-size: 12px;
      color: var(--ink-muted);
      font-weight: 600;
    }

    .diff-pill {
      display: inline-flex;
      align-items: center;
      padding: 3px 9px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
      white-space: nowrap;
    }

    .diff-self { background: var(--brass-soft); color: var(--brass); }
    .diff-win { background: var(--green-soft); color: var(--green); }
    .diff-lose { background: var(--red-soft); color: var(--red); }
    .diff-tie { background: rgba(167, 186, 205, 0.16); color: var(--ink-sub); }

    .pk-track {
      width: 100%;
      height: 11px;
      border-radius: 999px;
      background: #0b121c;
      overflow: hidden;
    }

    .pk-fill {
      height: 100%;
      border-radius: 999px;
      transition: width 0.85s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .pk-host {
      font-size: 12px;
      color: var(--ink-muted);
      overflow-wrap: anywhere;
    }

    .pk-drawer {
      margin-top: 14px;
      padding: 15px;
      border-radius: var(--radius-md);
      background: #0c141f;
      border: 1px solid var(--border-strong);
    }

    .pk-drawer-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 12px;
    }

    .pk-drawer-list {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
    }

    .pk-dim-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 9px 11px;
      border-radius: var(--radius-sm);
      background: var(--bg-elev);
      border: 1px solid var(--border);
      font-size: 13px;
    }

    /* ==================== 五大白話體檢卡 ==================== */
    .dim-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .dim-card {
      background: var(--bg-elev);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      overflow: hidden;
      transition: border-color 0.16s ease;
    }

    .dim-card.is-expanded {
      border-color: var(--brass);
    }

    .dim-card-trigger {
      width: 100%;
      text-align: left;
      background: transparent;
      border: 0;
      padding: 15px 15px 13px;
      display: flex;
      flex-direction: column;
      gap: 9px;
    }

    .dim-card-top {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .dim-q-wrap {
      display: flex;
      align-items: center;
      gap: 9px;
      min-width: 0;
    }

    .dim-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: rgba(228, 182, 92, 0.15);
      color: var(--brass);
      font-family: ui-monospace, "SF Mono", Menlo, monospace;
      font-size: 12px;
      font-weight: 800;
      flex-shrink: 0;
    }

    .dim-card h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 800;
      color: #ffffff;
      line-height: 1.35;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
      border: 1px solid transparent;
      white-space: nowrap;
    }

    .pill-mini {
      display: inline-flex;
      align-items: center;
      padding: 3px 9px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 700;
      background: var(--brass-soft);
      color: var(--brass);
    }

    .dim-bar-track {
      height: 8px;
      border-radius: 999px;
      background: #0b121c;
      overflow: hidden;
    }

    .dim-bar-fill {
      height: 100%;
      border-radius: 999px;
      transition: width 0.8s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .dim-status {
      margin: 0;
      font-size: 14px;
      color: var(--ink-sub);
    }

    .dim-toggle-hint {
      font-size: 12.5px;
      font-weight: 700;
      color: var(--brass);
    }

    .dim-body {
      padding: 0 15px 16px;
      display: flex;
      flex-direction: column;
      gap: 11px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      padding-top: 13px;
    }

    .why-lose-box {
      padding: 12px 13px;
      border-radius: var(--radius-sm);
      background: rgba(240, 124, 103, 0.11);
      border: 1px solid rgba(240, 124, 103, 0.32);
    }

    .why-lose-title {
      font-size: 12.5px;
      font-weight: 800;
      color: #ff9d8a;
      margin-bottom: 4px;
    }

    .why-lose-box p,
    .quick-fix-box p {
      margin: 0;
      font-size: 13.5px;
      color: var(--ink);
    }

    .quick-fix-box {
      padding: 12px 13px;
      border-radius: var(--radius-sm);
      background: rgba(52, 179, 153, 0.1);
      border: 1px solid rgba(52, 179, 153, 0.3);
    }

    .quick-fix-title {
      font-size: 12.5px;
      font-weight: 800;
      color: #62d8be;
      margin-bottom: 4px;
    }

    .pill-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
      gap: 8px;
    }

    .status-chip {
      padding: 8px 10px;
      border-radius: 10px;
      background: #0c141f;
      border: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 12.5px;
    }

    .chip-name { color: var(--ink-sub); }
    .chip-pass strong { color: var(--green); }
    .chip-warn strong { color: var(--brass); }
    .chip-fail strong { color: var(--red); }

    /* ==================== 優先先補這 3 件事 ==================== */
    .action-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .action-card {
      background: linear-gradient(155deg, #172536 0%, #101925 100%);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-md);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .action-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .action-num {
      font-size: 22px;
      font-weight: 900;
      color: var(--brass);
      line-height: 1;
    }

    .prio-badge {
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 800;
    }

    .prio-1 { background: var(--red-soft); color: #ff9d8a; }
    .prio-2 { background: var(--brass-soft); color: #f6d58a; }
    .prio-3 { background: var(--green-soft); color: #67dbc2; }

    .action-card h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 800;
      color: #ffffff;
    }

    .action-detail {
      margin: 0;
      font-size: 13.5px;
      color: var(--ink-sub);
    }

    .action-impact {
      margin-top: auto;
      padding-top: 8px;
      border-top: 1px dashed var(--border);
      font-size: 13px;
      color: #f3d796;
    }

    /* ==================== 底部 CTA 與頁尾 ==================== */
    .cta-box {
      background: linear-gradient(145deg, #172536, #111b28);
      border: 1px solid rgba(228, 182, 92, 0.5);
      border-radius: var(--radius-lg);
      padding: 20px 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .cta-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .btn-gold {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 46px;
      padding: 10px 20px;
      border-radius: 11px;
      border: 0;
      background: linear-gradient(180deg, #ecc26c 0%, #cf9839 100%);
      color: #080d14;
      font-weight: 900;
      font-size: 14.5px;
      text-decoration: none;
    }

    .btn-ghost {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 46px;
      padding: 10px 16px;
      border-radius: 11px;
      border: 1px solid var(--border-strong);
      background: var(--bg-elev);
      color: var(--ink);
      font-weight: 700;
      font-size: 14px;
    }

    .footer {
      font-size: 12px;
      color: var(--ink-muted);
      line-height: 1.7;
      padding: 0 4px;
    }

    @media (min-width: 720px) {
      body { padding: 28px 24px 68px; }
      .hero { padding: 28px 28px; }
      .card { padding: 24px 24px; }
      .hero-dashboard {
        grid-template-columns: 184px 1fr;
        gap: 26px;
      }
      .radar-layout {
        grid-template-columns: 1.05fr 0.95fr;
        gap: 22px;
      }
      .action-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }

    @media print {
      body { background: #ffffff; color: #0f172a; padding: 0; }
      .hero, .card, .cta-box, .dim-card, .action-card, .pk-row, .insight-panel {
        background: #ffffff !important;
        color: #0f172a !important;
        border-color: #cbd5e1 !important;
        box-shadow: none !important;
      }
      h1, h2, h3, .verdict-headline, .pk-name, .ring-num, .insight-q { color: #0f172a !important; }
      .hero-meta, .verdict-sub, .sec-sub, .dim-status, .action-detail, .footer { color: #475569 !important; }
      .btn-ghost { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <!-- 頂部動態得分儀表板 -->
    <header class="hero">
      <div class="hero-top-bar">
        <span class="eyebrow">阿男 GEO 實戰工坊・老闆專用白話體檢簡報</span>
        <span class="mode-badge">${isPkMode ? `同業 PK 模式（共 ${rankedAll.length} 站）` : "單站深度白話體檢"}</span>
      </div>
      <h1>${escapeHtml(displayName)}｜AI 獲客體質總覽</h1>
      <div class="hero-meta">
        <span>檢測網站：${escapeHtml(targetUrl)}</span>
        <span>檢測時間：${escapeHtml(readableTime)}</span>
      </div>

      <div class="hero-dashboard">
        <div class="ring-box" data-score-ring="1" data-target-score="${targetScore}">
          <svg class="ring-svg" viewBox="0 0 156 156" aria-hidden="true">
            <circle class="ring-track" cx="78" cy="78" r="${ringRadius}" />
            <circle
              id="hero-ring-progress"
              class="ring-progress"
              cx="78"
              cy="78"
              r="${ringRadius}"
              stroke-dasharray="${ringCircumference}"
              stroke-dashoffset="${finalOffset}"
            />
          </svg>
          <div class="ring-center">
            <span id="hero-score-num" class="ring-num mono">${targetScore}</span>
            <span class="ring-denom">總分 / 100</span>
          </div>
        </div>

        <div class="verdict-box">
          <div class="traffic-wrap">
            <div class="traffic-light" aria-label="紅黃綠燈狀態指示">
              <span class="lamp lamp-red${targetLight === "red" ? " is-lit" : ""}" title="紅燈"></span>
              <span class="lamp lamp-yellow${targetLight === "yellow" ? " is-lit" : ""}" title="黃燈"></span>
              <span class="lamp lamp-green${targetLight === "green" ? " is-lit" : ""}" title="綠燈"></span>
            </div>
            <span class="status-pill" style="background:${tMeta.bg};color:${tMeta.color};border-color:${tMeta.border};">${escapeHtml(tMeta.label)}</span>
          </div>
          <p class="verdict-headline">${escapeHtml(verdict.headline)}</p>
          <p class="verdict-sub">${escapeHtml(verdict.sub)}</p>
          ${pkHeroBadgeHtml}
        </div>
      </div>

      ${notesHtml}
    </header>

    <!-- 互動 SVG 五大能力雷達圖 -->
    <section class="section card">
      <div class="section-head">
        <div>
          <p class="sec-kicker">INTERACTIVE RADAR</p>
          <h2>五大 AI 獲客能力分佈圖</h2>
        </div>
        <span class="rank-pill">點擊頂點或圖例看解說</span>
      </div>
      <p class="sec-sub">圖形越飽滿，代表客人問 ChatGPT、Perplexity、Gemini 時，AI 越容易看懂並推薦你。點一下雷達圖頂點或下方圖例立即看白話解說。</p>

      <div class="radar-layout">
        <div class="radar-stage">
          ${radarSvg}
          ${radarLegendHtml}
        </div>

        <aside id="radar-insight" class="insight-panel" aria-live="polite">
          <div class="insight-top">
            <span id="insight-tag" class="insight-tag">白話即時解說・${escapeHtml(firstDim.shortLabel)}</span>
            <span id="insight-pill" class="pill" style="background:${firstMeta.bg};color:${firstMeta.color};border-color:${firstMeta.border};">${escapeHtml(firstMeta.short)}・${firstDim.score}%</span>
          </div>
          <h3 id="insight-q" class="insight-q">${escapeHtml(firstDim.question)}</h3>
          <p id="insight-status" class="insight-status">${escapeHtml(firstDim.status)}</p>
          <div class="insight-why">
            <strong>為什麼會少賺客人？</strong>
            <span id="insight-why-text">${escapeHtml(firstDim.whyLose)}</span>
          </div>
          <p class="insight-fix"><strong>白話怎麼補：</strong><span id="insight-fix-text">${escapeHtml(firstDim.quickFix)}</span></p>
        </aside>
      </div>
    </section>

    <!-- 彩色橫條 PK 對比圖 / 基準對比 -->
    ${pkSectionHtml}

    <!-- 100% 老闆白話五項健檢卡片 -->
    <section class="section card">
      <div class="section-head">
        <div>
          <p class="sec-kicker">PLAIN-LANGUAGE CHECKUP</p>
          <h2>五個老闆最該關心的問題（點擊看為什麼少賺客人）</h2>
        </div>
        <span class="rank-pill">零技術術語</span>
      </div>
      <p class="sec-sub">我們把所有網站底層設定，直接翻譯成 5 個跟營收最有關的問題；點開任一張卡片都能看實測細節與補強做法。</p>
      <div class="dim-list">
        ${dimCardsHtml}
      </div>
    </section>

    <!-- 優先先補這 3 件事 -->
    <section class="section card">
      <div class="section-head">
        <div>
          <p class="sec-kicker">TOP 3 PRIORITIES</p>
          <h2>優先先補這 3 件事（最有感、回報最快）</h2>
        </div>
        <span class="rank-pill">照順序做就好</span>
      </div>
      <p class="sec-sub">不用一次把整個網站打掉重練，先照下面這 3 個順序補齊，就能先把流失的 AI 詢問客接回來。</p>
      <div class="action-grid">
        ${top3Html}
      </div>
    </section>

    <!-- 下一步 CTA -->
    <section class="cta-box">
      <div class="section-head" style="margin-bottom:0;">
        <div>
          <p class="sec-kicker">NEXT STEP</p>
          <h2>想看 ChatGPT 與 Perplexity 實際有沒有點名你家店？</h2>
        </div>
      </div>
      <p class="sec-sub" style="margin:0;">
        這份簡報先幫你抓出網站公開門面的關鍵缺口；如果想直接看真實買家問 20 個問題時，AI 到底推薦了你還是推薦了對手、有沒有報錯價，歡迎預約「入門實測健檢」（NT$3,800，30 天內升級改造可全額折抵）。
      </p>
      <div class="cta-actions">
        <a class="btn-gold" href="${LINE_URL}" target="_blank" rel="noopener">加官方 LINE ${LINE_ID} 預約討論</a>
        <button type="button" id="print-brief-btn" class="btn-ghost">列印／存成 PDF</button>
      </div>
    </section>

    <footer class="footer">
      實測基準說明：參照阿男 GEO 實戰工坊 1,298 筆跨平台無痕實測案例（自有示範官網結構體質自 41 分提升至 89 分）建置。本簡報僅呈現公開網頁即時檢測結果，不保證固定排序或必被推薦；本工坊與客製紀念歌曲業務分開營運。
    </footer>
  </div>

  <script>
  (function () {
    "use strict";
    var DATA = ${safeJsonForScript(embeddedPayload)};
    var RING_C = ${ringCircumference};

    // 1. 頂部大分數圓環與橫條平滑動畫（從 0 跳到實測分數）
    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var ringEl = document.getElementById("hero-ring-progress");
    var numEl = document.getElementById("hero-score-num");
    var targetScore = Number(DATA.targetScore) || 0;

    if (!reduceMotion && ringEl && numEl) {
      ringEl.style.strokeDashoffset = String(RING_C);
      numEl.textContent = "0";
      var barEls = document.querySelectorAll("[data-bar-target]");
      barEls.forEach(function (el) { el.style.width = "0%"; });

      var startAt = null;
      var duration = 850;
      function tick(ts) {
        if (startAt === null) startAt = ts;
        var t = Math.min(1, (ts - startAt) / duration);
        var eased = 1 - Math.pow(1 - t, 3);
        var cur = Math.round(targetScore * eased);
        numEl.textContent = String(cur);
        ringEl.style.strokeDashoffset = String((RING_C * (1 - (targetScore * eased) / 100)).toFixed(2));
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          numEl.textContent = String(targetScore);
          ringEl.style.strokeDashoffset = String((RING_C * (1 - targetScore / 100)).toFixed(2));
        }
      }
      requestAnimationFrame(tick);
      requestAnimationFrame(function () {
        barEls.forEach(function (el) {
          el.style.width = (el.getAttribute("data-bar-target") || "0") + "%";
        });
      });
    }

    // 2. 點擊雷達圖節點或白話卡片，同步更新白話即時解說板
    var insightTag = document.getElementById("insight-tag");
    var insightPill = document.getElementById("insight-pill");
    var insightQ = document.getElementById("insight-q");
    var insightStatus = document.getElementById("insight-status");
    var insightWhy = document.getElementById("insight-why-text");
    var insightFix = document.getElementById("insight-fix-text");

    function selectDimension(dimKey) {
      var dim = null;
      for (var i = 0; i < DATA.dimensions.length; i += 1) {
        if (DATA.dimensions[i].key === dimKey) { dim = DATA.dimensions[i]; break; }
      }
      if (!dim) return;

      if (insightTag) insightTag.textContent = "白話即時解說・" + dim.shortLabel;
      if (insightPill) {
        insightPill.textContent = dim.lightLabel + "・" + dim.score + "%";
        insightPill.style.color = dim.color;
        insightPill.style.borderColor = dim.color;
      }
      if (insightQ) insightQ.textContent = dim.question;
      if (insightStatus) insightStatus.textContent = dim.status;
      if (insightWhy) insightWhy.textContent = dim.whyLose;
      if (insightFix) insightFix.textContent = dim.quickFix;

      document.querySelectorAll(".radar-dot-wrap").forEach(function (g) {
        g.classList.toggle("is-active", g.getAttribute("data-dim-key") === dimKey);
      });
      document.querySelectorAll(".legend-chip[data-dim-key]").forEach(function (btn) {
        btn.classList.toggle("is-selected", btn.getAttribute("data-dim-key") === dimKey);
      });
    }

    document.querySelectorAll("[data-dim-key]").forEach(function (el) {
      if (el.hasAttribute("data-dim-card")) return;
      el.addEventListener("click", function () {
        selectDimension(el.getAttribute("data-dim-key"));
      });
      el.addEventListener("keydown", function (evt) {
        if (evt.key === "Enter" || evt.key === " ") {
          evt.preventDefault();
          selectDimension(el.getAttribute("data-dim-key"));
        }
      });
    });

    // 3. 點擊五張白話體檢卡片展開／收合並聯動雷達圖解說
    document.querySelectorAll("[data-dim-card]").forEach(function (card) {
      var trigger = card.querySelector(".dim-card-trigger");
      var body = card.querySelector(".dim-body");
      var hint = card.querySelector(".dim-toggle-hint");
      if (!trigger || !body) return;
      trigger.addEventListener("click", function () {
        var expanded = card.classList.toggle("is-expanded");
        body.hidden = !expanded;
        trigger.setAttribute("aria-expanded", expanded ? "true" : "false");
        if (hint) hint.textContent = expanded ? "收起詳細說明 ▲" : "點我看：為什麼會少賺客人 ▼";
        selectDimension(card.getAttribute("data-dim-key"));
      });
    });

    // 4. PK 模式：點擊圖例切換雷達對手疊圖
    document.querySelectorAll("[data-radar-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var seriesId = btn.getAttribute("data-radar-toggle");
        var poly = document.querySelector('.radar-poly-comp[data-series-id="' + seriesId + '"]');
        if (!poly) return;
        var nowHidden = poly.classList.toggle("is-hidden");
        btn.classList.toggle("is-on", !nowHidden);
        btn.classList.toggle("is-off", nowHidden);
        btn.setAttribute("aria-pressed", nowHidden ? "false" : "true");
      });
    });

    // 5. PK 模式：點擊橫條展開「我方 vs 該對手」逐項白話勝負拆解
    var drawer = document.getElementById("pk-compare-drawer");
    var drawerTitle = document.getElementById("pk-drawer-title");
    var drawerBadge = document.getElementById("pk-drawer-badge");
    var drawerList = document.getElementById("pk-drawer-list");
    var activeCompId = null;

    function openPkDrawer(seriesId) {
      if (!drawer || !drawerList) return;
      if (seriesId === "self") {
        drawer.hidden = true;
        activeCompId = null;
        document.querySelectorAll("button.pk-row").forEach(function (r) {
          r.classList.remove("is-active");
          r.setAttribute("aria-expanded", "false");
        });
        return;
      }
      var comp = null;
      for (var i = 0; i < DATA.competitors.length; i += 1) {
        if (DATA.competitors[i].id === seriesId) { comp = DATA.competitors[i]; break; }
      }
      if (!comp) return;

      if (activeCompId === seriesId && !drawer.hidden) {
        drawer.hidden = true;
        activeCompId = null;
        document.querySelectorAll("button.pk-row").forEach(function (r) {
          r.classList.remove("is-active");
          r.setAttribute("aria-expanded", "false");
        });
        return;
      }

      activeCompId = seriesId;
      document.querySelectorAll("button.pk-row").forEach(function (r) {
        var isCur = r.getAttribute("data-pk-bar") === seriesId;
        r.classList.toggle("is-active", isCur);
        r.setAttribute("aria-expanded", isCur ? "true" : "false");
      });

      if (drawerTitle) drawerTitle.textContent = "逐項白話比較：我方 vs " + comp.name;
      if (drawerBadge) {
        drawerBadge.textContent =
          comp.diff > 0
            ? "總分我方領先 +" + comp.diff + " 分"
            : comp.diff < 0
              ? "總分落後對手 " + Math.abs(comp.diff) + " 分"
              : "總分平手";
      }

      while (drawerList.firstChild) drawerList.removeChild(drawerList.firstChild);
      DATA.dimensions.forEach(function (dim, idx) {
        var myVal = DATA.self.scores[idx] || 0;
        var rivalVal = comp.scores[idx] || 0;
        var gap = myVal - rivalVal;
        var row = document.createElement("div");
        row.className = "pk-dim-row";

        var left = document.createElement("span");
        left.textContent = dim.shortLabel + "（我方 " + myVal + "% vs 對手 " + rivalVal + "%）";

        var right = document.createElement("strong");
        if (gap > 0) {
          right.textContent = "我方贏 +" + gap + "%";
          right.style.color = "#34b399";
        } else if (gap < 0) {
          right.textContent = "落後 " + Math.abs(gap) + "%";
          right.style.color = "#f07c67";
        } else {
          right.textContent = "平手";
          right.style.color = "#e4b65c";
        }

        row.appendChild(left);
        row.appendChild(right);
        drawerList.appendChild(row);
      });

      drawer.hidden = false;
    }

    document.querySelectorAll("button.pk-row[data-pk-bar]").forEach(function (rowBtn) {
      rowBtn.addEventListener("click", function () {
        openPkDrawer(rowBtn.getAttribute("data-pk-bar"));
      });
    });

    // 6. 列印／存 PDF
    var printBtn = document.getElementById("print-brief-btn");
    if (printBtn) {
      printBtn.addEventListener("click", function () {
        window.print();
      });
    }
  })();
  </script>
</body>
</html>`;
}

if (typeof globalThis !== "undefined") {
  globalThis.AnanBossReport = {
    buildBossReportHtml,
    buildBossReportFilename,
    evaluateBossDimensions,
    escapeHtml,
  };
}
