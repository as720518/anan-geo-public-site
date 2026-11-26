/**
 * 阿男 GEO 實戰工坊 — 網站成交力 4 大指標診斷 ＆ 下週 5 篇五行發文處方箋（共用純標準模組）
 * 零外部依賴，供 functions/api/check.js、functions/api/lead.js 與後端簡報流程共用。
 *
 * 設計守則：
 * 1. 100% 源自真實抓回之 HTML 與頁面基本資訊，絕不捏造數字。
 * 2. 完全獨立於既有 GEO 100 分技術分數（絕不改動 score）。
 * 3. 全篇採用台灣實體店與在地品牌老闆聽得懂的自然白話，零誇大促銷與零生硬技術術語。
 */

export const MAX_THREE_LINE_UNITS = 54; // 手機每行約 18 全形字寬 × 3 行
export const LONG_PARA_CHAR_HARD_LIMIT = 120;

export const LIGHT_LABELS = {
  green: "綠燈",
  yellow: "黃燈",
  red: "紅燈",
};

export const WUXING_META = {
  water: { tag: "water", zh: "水", icon: "💧", role: "痛點故事篇", label: "💧 水｜痛點故事篇" },
  wood: { tag: "wood", zh: "木", icon: "🌱", role: "專業知識篇", label: "🌱 木｜專業知識篇" },
  metal: { tag: "metal", zh: "金", icon: "🪙", role: "成果見證篇", label: "🪙 金｜成果見證篇" },
  earth: { tag: "earth", zh: "土", icon: "🪴", role: "日常溫度篇", label: "🪴 土｜日常溫度篇" },
  fire: { tag: "fire", zh: "火", icon: "🔥", role: "破冰行動篇", label: "🔥 火｜破冰行動篇" },
};

const INDUSTRY_PROFILES = [
  {
    key: "beauty_wellness",
    label: "美容美體・美甲美睫・SPA",
    defaultService: "肩頸舒壓與肌膚保養",
    painScenario: "久坐緊繃、氣色暗沉或睡不好",
    careStandard: "手技力道調整、用品乾淨透明與預約流程",
    dailyDetail: "毛巾消毒、備茶與包廂通風整理",
    entryExample: "新客單次舒壓體驗",
    keywords: [
      "美容", "美體", "spa", "芳療", "精油", "撥筋", "采耳", "美甲", "美睫",
      "霧眉", "護膚", "岩盤浴", "越式洗頭", "越式洗髮", "做臉", "除毛", "舒壓",
      "按摩", "頭療", "頭皮淨化", "熱蠟", "花酸", "美學館", "美容室",
    ],
  },
  {
    key: "medical_health",
    label: "醫療診所・牙科・物理調理",
    defaultService: "門診評估與日常調理",
    painScenario: "反覆痠痛、牙口不適或一直猶豫不敢預約檢查",
    careStandard: "醫師溝通細心度、療程說明清楚與術後照護方式",
    dailyDetail: "器械高溫滅菌與候診空間整理",
    entryExample: "初診一對一檢查與評估",
    keywords: [
      "牙醫", "牙科", "診所", "植牙", "矯正", "全瓷冠", "醫美", "皮膚科", "中醫",
      "復健", "整復", "推拿", "物理治療", "骨科", "健檢", "療程", "醫師", "門診",
      "牙周", "洗牙", "保健", "心理諮商", "營養師", "醫療",
    ],
  },
  {
    key: "food_retail",
    label: "餐飲・烘焙・咖啡・伴手禮",
    defaultService: "招牌餐點與手作點心",
    painScenario: "聚餐或送禮挑半天怕踩雷、不知道哪一道最合口味",
    careStandard: "食材新鮮來源、甜度份量標示與保存期限說明",
    dailyDetail: "清晨挑豆試杯、烤箱預熱與食材備料",
    entryExample: "人氣招牌單人品嚐組合",
    keywords: [
      "餐廳", "咖啡", "烘焙", "甜點", "蛋糕", "伴手禮", "美食", "早午餐", "火鍋",
      "燒肉", "料理", "飲料", "茶飲", "麵包", "食堂", "居酒屋", "禮盒", "手作點心",
      "茶葉", "烘豆", "餐酒館", "小吃", "冰品",
    ],
  },
  {
    key: "b2b_manufacturing",
    label: "製造代工・精密加工・供應鏈",
    defaultService: "精密零件打樣與代工製造",
    painScenario: "急著找穩定配合工廠、擔心交期延誤或公差對不上",
    careStandard: "材質檢驗報告、最小訂購量透明與打樣確認流程",
    dailyDetail: "機台開機校正、首件量測與出廠品檢",
    entryExample: "小量打樣與圖面可行性初評",
    keywords: [
      "精密", "加工", "cnc", "模具", "射出", "工廠", "製造", "代工", "oem", "odm",
      "零件", "機械", "設備", "五金", "包裝材料", "金屬", "塑膠", "焊接", "自動化",
      "供應鏈", "批發", "廠房", "工業", "電子元件", "車床",
    ],
  },
  {
    key: "professional_service",
    label: "顧問・行銷・設計・軟體服務",
    defaultService: "品牌官網與專業顧問評估",
    painScenario: "投入不少時間與預算做網站和曝光，卻遲遲等不到精準詢問",
    careStandard: "過往實績公開度、報價邊界透明與驗收交付標準",
    dailyDetail: "盤點客戶資料、核對報價口徑與檢查細節清單",
    entryExample: "入門健檢與一對一方向診斷",
    keywords: [
      "geo", "seo", "顧問", "行銷", "設計", "軟體", "系統", "網頁設計", "網站",
      "法律", "會計", "律師", "記帳", "室內設計", "裝潢", "品牌策略", "攝影",
      "課程", "培訓", "教學", "工坊", "企劃", "廣告", "資訊服務",
    ],
  },
  {
    key: "custom_local",
    label: "客製與在地門市服務",
    defaultService: "專屬客製與在地門市服務",
    painScenario: "想找質感好又好溝通的在地店家，卻不知道第一步該怎麼開口詢問",
    careStandard: "需求溝通流程、製作時間透明與成品交付方式",
    dailyDetail: "整理工作台器物、確認當日預約細節與測試品質",
    entryExample: "入門體驗與免費初步諮詢",
    keywords: [
      "客製", "紀念歌", "原創歌", "手作", "花藝", "婚禮", "寵物", "民宿", "旅宿",
      "清潔", "搬家", "維修", "工作室", "門市", "在地", "選物", "音樂", "樂器",
      "瑜珈", "健身", "教室",
    ],
  },
];

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodeHtmlEntities(str) {
  return String(str || "")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, num) => {
      const code = Number(num);
      return Number.isFinite(code) && code >= 32 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
    })
    .replace(/\s+/g, " ")
    .trim();
}

function stripNonVisibleHtml(html) {
  return String(html || "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|template|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
}

function isHiddenTag(attrs) {
  const s = String(attrs || "");
  return (
    /(?:^|\s)hidden(?:\s*=|\s|$)/i.test(s) ||
    /aria-hidden\s*=\s*["']?true\b/i.test(s) ||
    /style\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(s)
  );
}

/**
 * 計算手機視覺字寬單位（全形字／標點／Emoji = 1.0，半形 ASCII = 0.55）
 */
export function calcVisualUnits(str) {
  const normalized = String(str ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return 0;
  let units = 0;
  for (const ch of normalized) {
    const code = ch.codePointAt(0) || 0;
    if (code >= 0x20 && code <= 0x7e) {
      units += 0.55;
    } else {
      units += 1.0;
    }
  }
  return Math.round(units * 100) / 100;
}

function clampPlainText(val, maxLen) {
  if (typeof val !== "string") return "";
  const cleaned = val.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen)}…` : cleaned;
}

function hostFromUrl(urlStr) {
  try {
    return new URL(String(urlStr || "")).hostname.replace(/^www\./i, "");
  } catch {
    return String(urlStr || "")
      .replace(/^https?:\/\//i, "")
      .split(/[/?#]/)[0]
      .replace(/^www\./i, "") || "貴站";
  }
}

function extractVisibleParagraphs(visibleHtml) {
  // 排除導覽列與頁尾版權區塊，聚焦主文段落
  const bodyOnly = String(visibleHtml || "")
    .replace(/<(nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  const pRe = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
  const paragraphs = [];
  let match;
  while ((match = pRe.exec(bodyOnly)) !== null) {
    if (isHiddenTag(match[1])) continue;
    const text = decodeHtmlEntities((match[2] || "").replace(/<[^>]+>/g, " "));
    if (text.length < 15) continue;
    if (/^(?:©|copyright|all rights reserved|版權所有)/i.test(text)) continue;
    paragraphs.push(text);
  }
  return paragraphs;
}

function extractTagsText(visibleHtml, tagNames) {
  const pattern = new RegExp(`<(${tagNames.join("|")})\\b([^>]*)>([\\s\\S]*?)<\\/\\1>`, "gi");
  const out = [];
  let match;
  while ((match = pattern.exec(String(visibleHtml || ""))) !== null) {
    if (isHiddenTag(match[2])) continue;
    const text = decodeHtmlEntities((match[3] || "").replace(/<[^>]+>/g, " "));
    if (text) out.push(text);
  }
  return out;
}

function cleanBrandName(rawTitle, rawH1, targetUrl) {
  const candidates = [rawTitle, rawH1]
    .map((s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  for (const cand of candidates) {
    const firstPart = cand.split(/[｜|—–\-：:]/)[0].trim();
    if (firstPart && firstPart.length >= 2 && firstPart.length <= 24) {
      return firstPart;
    }
    if (cand.length >= 2) {
      return cand.slice(0, 20).trim();
    }
  }
  return hostFromUrl(targetUrl);
}

function extractCoreService(rawTitle, rawH1, rawDesc, industry) {
  const titleParts = String(rawTitle || "")
    .replace(/<[^>]+>/g, " ")
    .split(/[｜|—–\-：:]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3 && s.length <= 22);

  if (titleParts.length >= 2) {
    const second = titleParts[1].replace(/[。！？!?,，；;].*$/, "").trim();
    if (second.length >= 3 && second.length <= 18) {
      return second;
    }
  }

  const h1Clean = String(rawH1 || "")
    .replace(/<[^>]+>/g, " ")
    .split(/[｜|—–\-：:]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3 && s.length <= 18);
  if (h1Clean.length >= 2) {
    return h1Clean[1];
  }

  const combined = `${rawTitle || ""} ${rawH1 || ""} ${rawDesc || ""}`;
  for (const kw of industry.keywords) {
    if (kw.length >= 2 && combined.toLowerCase().includes(kw.toLowerCase())) {
      return industry.defaultService;
    }
  }
  return industry.defaultService;
}

/**
 * 依網站標題、主標、描述與正文辨識 6 大常見台灣行業與核心服務主題
 */
export function detectIndustryAndTopic({ html = "", title = "", h1 = "", description = "", targetUrl = "" } = {}) {
  const visibleText = decodeHtmlEntities(stripNonVisibleHtml(html).replace(/<[^>]+>/g, " ")).slice(0, 3000);
  const headText = `${title || ""} ${h1 || ""} ${description || ""}`.toLowerCase();
  const fullText = `${headText} ${visibleText.toLowerCase()}`;

  let bestProfile = INDUSTRY_PROFILES[INDUSTRY_PROFILES.length - 1]; // custom_local 預設
  let bestScore = 0;

  for (const profile of INDUSTRY_PROFILES) {
    let score = 0;
    for (const kw of profile.keywords) {
      const k = kw.toLowerCase();
      if (headText.includes(k)) score += 3;
      else if (fullText.includes(k)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestProfile = profile;
    }
  }

  const brandLabel = cleanBrandName(title, h1, targetUrl);
  const coreService = extractCoreService(title, h1, description, bestProfile);

  return {
    brandLabel,
    coreService,
    industry: bestProfile,
  };
}

/**
 * 掃描受檢網頁 HTML 之四大成交力指標（conversion_diagnosis）
 */
export function diagnoseConversion({ html = "", meta = {} } = {}) {
  const visibleHtml = stripNonVisibleHtml(html);
  const visibleText = decodeHtmlEntities(visibleHtml.replace(/<[^>]+>/g, " "));
  const schemaTypes = Array.isArray(meta.schema_types)
    ? meta.schema_types.map((t) => String(t).toLowerCase())
    : [];

  // 1. 手機三行好讀度（mobile_readability）
  const paragraphs = extractVisibleParagraphs(visibleHtml);
  const totalParaCount = paragraphs.length;
  let longParaCount = 0;
  let maxParaChars = 0;
  let maxParaUnits = 0;

  for (const p of paragraphs) {
    const units = calcVisualUnits(p);
    if (p.length > maxParaChars) maxParaChars = p.length;
    if (units > maxParaUnits) maxParaUnits = units;
    if (units > MAX_THREE_LINE_UNITS || p.length > LONG_PARA_CHAR_HARD_LIMIT) {
      longParaCount += 1;
    }
  }

  const longParaRatio =
    totalParaCount > 0 ? Math.round((longParaCount / totalParaCount) * 100) / 100 : 0;
  const longParaPct = Math.round(longParaRatio * 100);

  let readLight = "green";
  let readSummary = "";
  let readRec = "";
  if (totalParaCount === 0) {
    readLight = "yellow";
    readSummary = "首頁幾乎沒有可讀的純文字段落（可能多半做成圖片或單行短字），手機訪客不易快速了解服務特色。";
    readRec = "建議補上 3～5 段白話服務介紹，每段控制在手機 3 行內（約 50 字內）並留白分段。";
  } else if (longParaRatio > 0.45 || maxParaChars > LONG_PARA_CHAR_HARD_LIMIT) {
    readLight = "red";
    readSummary = `共掃描 ${totalParaCount} 段正文，有 ${longParaCount} 段（${longParaPct}%）超過手機 3 行，最長單段達 ${maxParaChars} 字，手機滑起來會像整面文字牆。`;
    readRec = "把超過 3 行的密集長段在句號處拆開並空一行，讓忙碌的老闆與客人滑手機 3 秒就能抓住重點。";
  } else if (longParaRatio > 0.2) {
    readLight = "yellow";
    readSummary = `共掃描 ${totalParaCount} 段正文，其中 ${longParaCount} 段（${longParaPct}%）偏長超過手機 3 行，部分區塊閱讀略顯吃力。`;
    readRec = "將偏長的介紹段落拆成每段 2～3 行小短段，並善用 1-2-3 條列提升手機瀏覽停駐率。";
  } else {
    readLight = "green";
    readSummary = `共掃描 ${totalParaCount} 段正文，長段比例僅 ${longParaPct}%（最長 ${maxParaChars} 字），手機滑讀節奏清爽好消化。`;
    readRec = "保持目前每段不超過 3 行的好讀節奏，未來新增案例或問答時也延續此留白規範即可。";
  }

  // 2. 客人痛點與常識問答（pain_and_knowledge｜水＋木）
  const headingsAndDetails = extractTagsText(visibleHtml, ["h2", "h3", "summary", "dt"]);
  const qaQuestionSignals = [
    /[？?]/,
    /為什麼|怎麼挑|怎麼選|適合誰|常見問題|常見問答|注意事項|多久|痛不痛|會不會|保養|差別|差異|迷思|步驟|如何分辨/,
  ];
  const painSignals = [
    /困擾|煩惱|睡不好|緊繃|卡關|擔心|猶豫|怕痛|痠痛|過敏|暗沉|不自然|踩雷|報錯|找不到|花冤枉錢|不敢|疑問|顧慮/,
  ];

  const hasDetailsTag = /<details\b/i.test(visibleHtml);
  const hasFaqHeading = headingsAndDetails.some((t) => /常見問題|常見問答|\bfaq\b|q\s*&\s*a|買家問答/i.test(t));
  const hasQaSection = Boolean(meta.has_faq_page || schemaTypes.includes("faqpage") || hasDetailsTag || hasFaqHeading);

  let qaHitCount = 0;
  const scannedBlocks = [...headingsAndDetails, ...paragraphs];
  for (const block of scannedBlocks) {
    const hitQuestion = qaQuestionSignals.some((re) => re.test(block));
    const hitPain = painSignals.some((re) => re.test(block));
    if (hitQuestion || hitPain) {
      qaHitCount += 1;
    }
  }

  let painLight = "red";
  let painSummary = "";
  let painRec = "";
  if (hasQaSection && qaHitCount >= 3) {
    painLight = "green";
    painSummary = `頁面設有明確問答區塊，且命中 ${qaHitCount} 處客人痛點與專業常識說明，能有效安撫新客疑慮並幫助問答引擎引用。`;
    painRec = "可持續把店裡客人每週最常私訊的新疑問補進問答區，讓內容越養越準。";
  } else if (qaHitCount >= 1 || hasQaSection) {
    painLight = "yellow";
    painSummary = hasQaSection
      ? `雖有問答區塊，但僅命中 ${qaHitCount} 處痛點或教學說明，對初次上門客人的顧慮解答還不夠具體。`
      : `文字中零星提到 ${qaHitCount} 處疑問或情境，但缺少獨立的「客人常見問答」區塊，訪客得自己到處翻找答案。`;
    painRec = "挑出客人最常問的 5 個顧慮（怕踩雷、適合誰、前後注意事項）做成一問一答專區，直接對應水（痛點）與木（知識）。";
  } else {
    painLight = "red";
    painSummary = "首頁幾乎只有硬邦邦的服務名稱與規格介紹，偵測不到客人常見問答或痛點共鳴句（0 處命中）。";
    painRec = "立刻在首頁補上「客人最常問的 3～5 題」，用客人自己的煩惱開場，別讓新客看完滿頭問號直接關分頁。";
  }

  // 3. 真實案例與客人見證（proof_and_cases｜金）
  const hasStructuredProof =
    schemaTypes.includes("review") ||
    schemaTypes.includes("aggregaterating");
  const proofKeywords = [
    "真實案例", "案例", "實測", "作品", "客戶回饋", "客人回饋", "回饋",
    "好評", "見證", "改造前", "改造後", "前後對照", "客戶評價", "客人說",
    "服務紀錄", "試聽", "實拍", "心得", "回訪", "口碑",
  ];
  const matchedProofTerms = new Set();
  for (const kw of proofKeywords) {
    if (visibleText.includes(kw)) {
      matchedProofTerms.add(kw);
    }
  }
  const hasCaseHeading = headingsAndDetails.some((t) => /案例|見證|回饋|好評|實測|作品|評價|對照/.test(t));
  const proofSignalCount =
    (hasStructuredProof ? 1 : 0) +
    (hasCaseHeading ? 1 : 0) +
    (matchedProofTerms.size >= 2 ? 2 : matchedProofTerms.size);

  let proofLight = "red";
  let proofSummary = "";
  let proofRec = "";
  if (proofSignalCount >= 2 && (hasStructuredProof || hasCaseHeading || matchedProofTerms.size >= 2)) {
    proofLight = "green";
    proofSummary = `頁面已呈現真實案例或客人回饋見證（命中 ${matchedProofTerms.size} 類見證信號${hasStructuredProof ? "＋結構化評價標記" : ""}），能有效幫陌生訪客建立信任。`;
    proofRec = "建議每個月固定新增 1～2 則「來之前的困擾 → 完成後的改變」真實服務紀錄，口碑會越滾越穩。";
  } else if (proofSignalCount === 1) {
    proofLight = "yellow";
    proofSummary = "頁面僅零星提及 1 處案例或評價字眼，缺少獨立清楚的「真實案例與客人見證」專區。";
    proofRec = "整理 2～3 則真實客人回饋與前後對照故事放上首頁，讓新客看到「跟我一樣狀況的人真的有幫助」。";
  } else {
    proofLight = "red";
    proofSummary = "首頁完全未偵測到真實案例、作品紀錄或客人見證信號，陌生客人很難安心把第一筆預算交給你。";
    proofRec = "補上至少 2 則去識別化的真實服務案例與客人回饋（屬於五行中的「金」），大幅降低新客觀望時間。";
  }

  // 4. 低門檻破冰體驗入口（entry_ladder｜火・三層體驗階梯）
  const entryKeywords = [
    "初次體驗", "首次體驗", "入門體驗", "入門方案", "入門級", "基礎健檢",
    "免費初檢", "免費健檢", "免費檢測", "免費諮詢", "單次體驗", "試聽",
    "體驗課", "體驗價", "體驗組", "初診評估", "破冰體驗", "免費體驗",
    "免費評估", "先挑", "入門版", "小量打樣",
  ];
  const bookingKeywords = [
    "立即預約", "線上預約", "預約諮詢", "預約時段", "預約", "加 line",
    "加line", "官方 line", "官方line", "私訊預約", "開始免費", "立即諮詢", "line.me",
  ];
  const pricePattern = /(?:nt\$\s*[\d,]+|ntd\s*[\d,]+|\$\s*[\d,]+|[\d,]+\s*元(?:起)?|免費)/i;

  const lowerVisible = visibleText.toLowerCase();
  const lowerHtml = visibleHtml.toLowerCase();
  const hasEntryOffer = entryKeywords.some((kw) => lowerVisible.includes(kw.toLowerCase()));
  const hasPublicPrice =
    pricePattern.test(visibleText) ||
    schemaTypes.includes("offer") ||
    Boolean(meta.has_visible_table);
  const hasBookingCta =
    bookingKeywords.some((kw) => lowerVisible.includes(kw.toLowerCase()) || lowerHtml.includes(kw.toLowerCase()));

  let entryLight = "red";
  let entrySummary = "";
  let entryRec = "";
  if (hasEntryOffer && hasPublicPrice && hasBookingCta) {
    entryLight = "green";
    entrySummary = "同時具備低門檻入門體驗項、透明價格資訊與明確預約入口，陌生客人第一步跨進門零壓力。";
    entryRec = "維持「入門破冰項 → 主力招牌項 → 熟客定期養護」三層階梯結構，並定期確認預約按鈕在手機上好按。";
  } else if (hasBookingCta || hasEntryOffer || hasPublicPrice) {
    entryLight = "yellow";
    const missingParts = [];
    if (!hasEntryOffer) missingParts.push("新客專屬低門檻初次體驗項");
    if (!hasPublicPrice) missingParts.push("公開透明起步費用");
    if (!hasBookingCta) missingParts.push("明確的一鍵預約／官方 LINE 入口");
    entrySummary = `已有部分引導元素，但仍缺少：${missingParts.join("、")}，容易讓觀望中的新客看完卻不知道第一步怎麼開始。`;
    entryRec = "在首頁清楚擺出一個「新客第一步入門體驗」項目，寫明所需時間、公開透明費用與官方 LINE 預約按鈕。";
  } else {
    entryLight = "red";
    entrySummary = "首頁既沒有公開透明價格，也沒有低門檻初次體驗方案或明確預約引導，客人看完容易直接離開。";
    entryRec = "設計一個 30～45 分鐘、費用透明的「新客入門破冰體驗項」並加上明顯預約按鈕（屬於五行中的「火」）。";
  }

  const indicators = [
    {
      key: "mobile_readability",
      name: "手機三行好讀度",
      wuxing_label: "三行好讀排版",
      light: readLight,
      light_label: LIGHT_LABELS[readLight],
      summary: readSummary,
      recommendation: readRec,
      metrics: {
        total_para_count: totalParaCount,
        long_para_count: longParaCount,
        long_para_ratio: longParaRatio,
        max_para_chars: maxParaChars,
      },
    },
    {
      key: "pain_and_knowledge",
      name: "客人痛點與常識問答",
      wuxing_label: "水・痛點 ＋ 木・知識",
      light: painLight,
      light_label: LIGHT_LABELS[painLight],
      summary: painSummary,
      recommendation: painRec,
      metrics: {
        has_qa_section: hasQaSection,
        hit_count: qaHitCount,
      },
    },
    {
      key: "proof_and_cases",
      name: "真實案例與客人見證",
      wuxing_label: "金・成果見證",
      light: proofLight,
      light_label: LIGHT_LABELS[proofLight],
      summary: proofSummary,
      recommendation: proofRec,
      metrics: {
        has_structured_proof: hasStructuredProof,
        matched_signal_count: matchedProofTerms.size,
      },
    },
    {
      key: "entry_ladder",
      name: "低門檻破冰體驗入口",
      wuxing_label: "火・三層體驗階梯",
      light: entryLight,
      light_label: LIGHT_LABELS[entryLight],
      summary: entrySummary,
      recommendation: entryRec,
      metrics: {
        has_entry_offer: hasEntryOffer,
        has_public_price: hasPublicPrice,
        has_booking_cta: hasBookingCta,
      },
    },
  ];

  const greenCount = indicators.filter((i) => i.light === "green").length;
  const yellowCount = indicators.filter((i) => i.light === "yellow").length;
  const redCount = indicators.filter((i) => i.light === "red").length;

  let overallLight = "green";
  if (redCount >= 2 || (redCount >= 1 && greenCount === 0)) {
    overallLight = "red";
  } else if (redCount >= 1 || yellowCount >= 1) {
    overallLight = "yellow";
  }

  const summary =
    greenCount === 4
      ? "4 項網站成交力指標全數綠燈！手機好讀、痛點問答、真實見證與破冰入口都已就定位。"
      : `4 項成交力指標目前 ${greenCount} 綠、${yellowCount} 黃、${redCount} 紅；先從紅黃燈缺口搭配下方五行發文處方箋補齊，詢問轉換最有感。`;

  return {
    overall_light: overallLight,
    overall_light_label: LIGHT_LABELS[overallLight],
    green_count: greenCount,
    yellow_count: yellowCount,
    red_count: redCount,
    summary,
    indicators,
  };
}

/**
 * 產出專屬下週 5 篇五行發文處方箋（週一至週五完整覆蓋水、木、金、土、火）
 */
export function generateWeeklyWuxingPrescription({ brandLabel, coreService, industry, diagnosis } = {}) {
  const safeBrand = clampPlainText(brandLabel || "本店", 24) || "本店";
  const profile = industry || INDUSTRY_PROFILES[INDUSTRY_PROFILES.length - 1];
  const safeService = clampPlainText(coreService || profile.defaultService, 22) || profile.defaultService;

  const indMap = {};
  if (diagnosis && Array.isArray(diagnosis.indicators)) {
    for (const ind of diagnosis.indicators) {
      indMap[ind.key] = ind;
    }
  }

  const gapNote = (key, label) => {
    const ind = indMap[key];
    if (!ind) return `補強面向：${label}`;
    if (ind.light === "red") return `優先修補紅燈缺口：${label}`;
    if (ind.light === "yellow") return `順手強化黃燈項目：${label}`;
    return `持續穩固綠燈優勢：${label}`;
  };

  const posts = [
    {
      day: "週一",
      element_tag: "water",
      element_zh: WUXING_META.water.zh,
      element_icon: WUXING_META.water.icon,
      element_label: WUXING_META.water.label,
      target_gap: "pain_and_knowledge",
      priority_note: gapNote("pain_and_knowledge", "客人痛點共鳴"),
      title: `明明已經${profile.painScenario}，為什麼很多人對「${safeService}」還是遲遲不敢踏出第一步？`,
      writing_tips: [
        "第 1 段（2～3 行）：寫一位客人剛來時隨口說出的一句真實煩惱，讓有同樣困擾的人立刻點頭。",
        "第 2 段（2～3 行）：同理大家最怕踩的 2 個顧慮（怕不好溝通、怕費用不透明），不講大道理。",
        "第 3 段（1～2 行）：溫和安撫並留一句輕巧邀請，提醒有疑問可以先私訊聊聊。",
      ],
      mobile_format_tip: "每段不超過手機 3 行就空一行，滑過去 3 秒就能看完重點。",
    },
    {
      day: "週二",
      element_tag: "wood",
      element_zh: WUXING_META.wood.zh,
      element_icon: WUXING_META.wood.icon,
      element_label: WUXING_META.wood.label,
      target_gap: "pain_and_knowledge",
      priority_note: gapNote("pain_and_knowledge", "專業問答與搜尋引用"),
      title: `挑選「${safeService}」前先看這 3 點！避開外行人最常白花錢的迷思`,
      writing_tips: [
        `第 1 段（2 行）：直接點出挑選時最容易忽略的關鍵（例如：${profile.careStandard}）。`,
        "第 2 段（1-2-3 條列）：用白話列出 3 個客人自己就能判斷的實用標準，每點不超過 2 行。",
        "第 3 段（1～2 行）：同步放進官網常見問答區，讓搜尋與問答引擎以後優先引用你家說法。",
      ],
      mobile_format_tip: "條列用 1. 2. 3. 分開並留白，不要把三點擠成同一段。",
    },
    {
      day: "週三",
      element_tag: "metal",
      element_zh: WUXING_META.metal.zh,
      element_icon: WUXING_META.metal.icon,
      element_label: WUXING_META.metal.label,
      target_gap: "proof_and_cases",
      priority_note: gapNote("proof_and_cases", "真實案例與客人見證"),
      title: `${safeBrand}真實服務紀錄：從原本卡關猶豫，到完成「${safeService}」後鬆一口氣的前後對照`,
      writing_tips: [
        "第 1 段（2～3 行）：交代客人來之前遇到的真實狀況與猶豫點（保留隱私、不誇張編造）。",
        "第 2 段（2～3 行）：說清楚我們幫他調整或把關了哪 1～2 個關鍵細節。",
        "第 3 段（2 行）：引述客人完成後最真實的一句回饋，自然展現專業與安心感。",
      ],
      mobile_format_tip: "搭配 1 張店內實拍或成品細節圖，信任感會比純文字高出一倍。",
    },
    {
      day: "週四",
      element_tag: "earth",
      element_zh: WUXING_META.earth.zh,
      element_icon: WUXING_META.earth.icon,
      element_label: WUXING_META.earth.label,
      target_gap: "mobile_readability",
      priority_note: gapNote("mobile_readability", "日常溫度與熟客互動"),
      title: `開店門前的 30 分鐘準備日常：為什麼${safeBrand}堅持在這個小細節慢慢來？`,
      writing_tips: [
        `第 1 段（2 行）：拍一張工作台或備料角落自然光實拍照，分享「${profile.dailyDetail}」的小習慣。`,
        "第 2 段（2～3 行）：聊聊為什麼願意多花這 30 分鐘，讓熟客感受到店裡的用心溫度。",
        "第 3 段（1～2 行）：跟在地鄰居與老朋友打聲招呼，不必硬推商品，純粹累積好感。",
      ],
      mobile_format_tip: "日常文越像跟熟客聊天越自然，全程控制在 150～220 字最剛好。",
    },
    {
      day: "週五",
      element_tag: "fire",
      element_zh: WUXING_META.fire.zh,
      element_icon: WUXING_META.fire.icon,
      element_label: WUXING_META.fire.label,
      target_gap: "entry_ladder",
      priority_note: gapNote("entry_ladder", "低門檻破冰體驗入口"),
      title: `第一次來${safeBrand}不知道怎麼選？專為新朋友準備的「${profile.entryExample}」流程公開`,
      writing_tips: [
        `第 1 段（2 行）：直接跟第一次觀望的新朋友介紹「${profile.entryExample}」，降低陌生門檻。`,
        "第 2 段（2～3 行）：把流程、大約時間與公開透明費用一次寫明白，強調零推銷壓力。",
        "第 3 段（1～2 行）：放上官方 LINE 或預約方式，邀請想先試試水溫的客人直接預約時段。",
      ],
      mobile_format_tip: "價目與預約連結單獨成行留白，手機點起來最順手。",
    },
  ];

  return {
    brand_label: safeBrand,
    industry_key: profile.key,
    industry_label: profile.label,
    core_service: safeService,
    headline: `贈送：${safeBrand} 專屬下週 5 篇五行發文處方箋`,
    intro: `系統依貴站內容辨識為「${profile.label}」，幫你排好週一到週五金木水火土完整一輪發文清單，連白話標題與 3 行寫法都準備好了。`,
    posts,
    cta_hooks: {
      site_upgrade:
        "想把這套問答與體驗階梯直接寫進官網，讓搜尋與問答引擎主動推薦你？加官方 LINE @954pwtpz 預約官網改造評估。",
      line_helper:
        "沒空自己排版發文？開通 LINE@ 自動發文小幫手，對手機講 20 秒語音就幫你切好三行同步官網與 Threads！",
    },
  };
}

/**
 * 一站式執行：網站成交力 4 大指標診斷 ＋ 行業辨識 ＋ 下週 5 篇五行發文處方箋
 */
export function analyzeConversionAndPrescription({ html = "", targetUrl = "", meta = {} } = {}) {
  const diagnosis = diagnoseConversion({ html, meta });
  const detected = detectIndustryAndTopic({
    html,
    title: meta.title || "",
    h1: meta.h1_text || "",
    description: meta.description || "",
    targetUrl,
  });
  const prescription = generateWeeklyWuxingPrescription({
    brandLabel: detected.brandLabel,
    coreService: detected.coreService,
    industry: detected.industry,
    diagnosis,
  });

  return {
    conversion_diagnosis: diagnosis,
    weekly_wuxing_prescription: prescription,
  };
}

/**
 * 清理與正規化前端傳來之 conversion_diagnosis（供 /api/lead 防注入與防超大負載使用）
 */
export function sanitizeConversionDiagnosis(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.indicators) || raw.indicators.length === 0) {
    return null;
  }
  const allowedKeys = new Set([
    "mobile_readability",
    "pain_and_knowledge",
    "proof_and_cases",
    "entry_ladder",
  ]);
  const indicators = [];
  for (const item of raw.indicators.slice(0, 4)) {
    if (!item || typeof item !== "object") continue;
    const key = typeof item.key === "string" && allowedKeys.has(item.key) ? item.key : "";
    if (!key) continue;
    const light = item.light === "green" || item.light === "yellow" || item.light === "red" ? item.light : "yellow";
    indicators.push({
      key,
      name: clampPlainText(item.name || key, 40),
      wuxing_label: clampPlainText(item.wuxing_label || "", 32),
      light,
      light_label: LIGHT_LABELS[light],
      summary: clampPlainText(item.summary || "", 240),
      recommendation: clampPlainText(item.recommendation || "", 240),
    });
  }
  if (indicators.length === 0) return null;

  const greenCount = indicators.filter((i) => i.light === "green").length;
  const yellowCount = indicators.filter((i) => i.light === "yellow").length;
  const redCount = indicators.filter((i) => i.light === "red").length;
  const overallLight =
    redCount >= 2 || (redCount >= 1 && greenCount === 0)
      ? "red"
      : redCount >= 1 || yellowCount >= 1
        ? "yellow"
        : "green";

  return {
    overall_light: overallLight,
    overall_light_label: LIGHT_LABELS[overallLight],
    green_count: greenCount,
    yellow_count: yellowCount,
    red_count: redCount,
    summary: clampPlainText(raw.summary || "", 260),
    indicators,
  };
}

/**
 * 清理與正規化前端傳來之 weekly_wuxing_prescription（供 /api/lead 防注入與防超大負載使用）
 */
export function sanitizeWeeklyPrescription(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.posts) || raw.posts.length === 0) {
    return null;
  }
  const allowedElements = new Set(["water", "wood", "metal", "earth", "fire"]);
  const posts = [];
  for (const item of raw.posts.slice(0, 5)) {
    if (!item || typeof item !== "object") continue;
    const elTag = allowedElements.has(item.element_tag) ? item.element_tag : "earth";
    const meta = WUXING_META[elTag];
    const tips = Array.isArray(item.writing_tips)
      ? item.writing_tips.slice(0, 3).map((t) => clampPlainText(t, 160)).filter(Boolean)
      : [];
    posts.push({
      day: clampPlainText(item.day || "", 8) || `第${posts.length + 1}天`,
      element_tag: elTag,
      element_zh: meta.zh,
      element_icon: meta.icon,
      element_label: meta.label,
      priority_note: clampPlainText(item.priority_note || "", 80),
      title: clampPlainText(item.title || "", 120),
      writing_tips: tips,
      mobile_format_tip: clampPlainText(item.mobile_format_tip || "", 100),
    });
  }
  if (posts.length === 0) return null;

  return {
    brand_label: clampPlainText(raw.brand_label || "貴站", 30),
    industry_key: clampPlainText(raw.industry_key || "custom_local", 32),
    industry_label: clampPlainText(raw.industry_label || "在地品牌服務", 40),
    core_service: clampPlainText(raw.core_service || "", 32),
    headline: clampPlainText(raw.headline || "專屬下週 5 篇五行發文處方箋", 80),
    intro: clampPlainText(raw.intro || "", 220),
    posts,
  };
}

/**
 * 將成交力診斷與下週 5 篇五行發文處方箋整理成乾淨好貼的純文字（供一鍵複製與純文字信使用）
 */
export function formatPrescriptionPlainText(diagnosis, prescription) {
  const lines = [];
  if (diagnosis && Array.isArray(diagnosis.indicators) && diagnosis.indicators.length > 0) {
    lines.push("【網站成交力 4 大指標診斷】");
    for (const ind of diagnosis.indicators) {
      lines.push(`- ${ind.name}（${ind.light_label || LIGHT_LABELS[ind.light] || ""}）：${ind.summary}`);
    }
    lines.push("");
  }
  if (prescription && Array.isArray(prescription.posts) && prescription.posts.length > 0) {
    lines.push(`【${prescription.headline || "下週 5 篇五行發文處方箋"}】`);
    if (prescription.industry_label) {
      lines.push(`辨識行業：${prescription.industry_label}`);
    }
    for (const post of prescription.posts) {
      lines.push("");
      lines.push(`${post.day}｜${post.element_label}`);
      lines.push(`擬定標題：${post.title}`);
      if (Array.isArray(post.writing_tips)) {
        for (const tip of post.writing_tips) {
          lines.push(`  • ${tip}`);
        }
      }
    }
    lines.push("");
    lines.push("想把問答與破冰階梯寫進官網，或開通 LINE@ 語音自動發文：加官方 LINE @954pwtpz");
  }
  return lines.join("\n").trim();
}
