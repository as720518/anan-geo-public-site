/**
 * 阿男 GEO 雲端後台 — 方案折抵與合夥人分潤試算引擎 ＋ App 內報告安全預覽控制器
 * 零外部依賴、純前端與 Node 測試共用模組（絕不外洩內部成本與分潤至客戶報價文字）
 */

const LINE_ID = "@250ruauk";

export const PLANS = Object.freeze([
  Object.freeze({
    id: "audit_3800",
    name: "深度健檢包",
    shortLabel: "NT$3,800 深度健檢",
    price: 3800,
    unitLabel: "／單次",
    defaultDirectCost: 0,
    directCostHint: "純健檢交付無額外網域實支（預設 NT$0）",
    summary: "20 題跨平台無痕實測＋競品雷達圖簡報＋老闆優先補強清單（30 天內升級可全額折抵 NT$3,800）",
    isRecurring: false,
    supportsCredit3800: false,
    supportsReferral2000: true,
  }),
  Object.freeze({
    id: "geo_18000",
    name: "官網 GEO 改造",
    shortLabel: "NT$18,000 官網 GEO 改造",
    price: 18000,
    unitLabel: "／單次專案",
    defaultDirectCost: 0,
    directCostHint: "沿用現有官網網域與空間（預設實支 NT$0）",
    summary: "現有官網全套 GEO 地基改造：AI 開門規則、AI 導覽手冊、數位名片、純文字價目表與常見問答",
    isRecurring: false,
    supportsCredit3800: true,
    supportsReferral2000: true,
  }),
  Object.freeze({
    id: "turnkey_25000",
    name: "實體店一條龍官網（含活動表格）",
    shortLabel: "NT$25,000 實體店一條龍官網",
    price: 25000,
    unitLabel: "／單次專案",
    defaultDirectCost: 400,
    directCostHint: "Cloudflare 主機 0 元月租；獨立網域年費實支約 NT$350～450（預設 NT$400，自備網域可改 0）",
    summary: "專屬高質感獨立官網＋0 元主機月租託管＋海報轉 AI 可抄純文字活動價目表與在地 FAQ",
    isRecurring: false,
    supportsCredit3800: true,
    supportsReferral2000: true,
  }),
  Object.freeze({
    id: "monthly_2000",
    name: "活動更新維護",
    shortLabel: "NT$2,000／月 活動更新維護",
    price: 2000,
    unitLabel: "／月",
    defaultDirectCost: 0,
    directCostHint: "每月海報文字化更新與 AI 曝光追蹤（預設實支 NT$0）",
    summary: "每月海報／新價目轉純文字表格更新、FAQ 同步維護與 AI 曝光追蹤月報",
    isRecurring: true,
    supportsCredit3800: false,
    supportsReferral2000: false,
  }),
]);

export const ADJUSTMENTS = Object.freeze([
  Object.freeze({
    id: "none",
    label: "無折抵（原價）",
    shortDesc: "依標準公開定價收費",
  }),
  Object.freeze({
    id: "credit_3800",
    label: "30 天內健檢 NT$3,800 全額折抵",
    shortDesc: "先做健檢、30 天內升級改造／一條龍全額折抵",
  }),
  Object.freeze({
    id: "opening_90",
    label: "合夥人開幕專案 9 折",
    shortDesc: "特約合夥人開幕專案價（原價 9 成）",
  }),
  Object.freeze({
    id: "referral_2000",
    label: "老客戶介紹減 NT$2,000",
    shortDesc: "老客戶引薦單次專案立減 NT$2,000",
  }),
]);

export const PARTNER_TIERS = Object.freeze([
  Object.freeze({
    id: "intro_25",
    label: "純介紹帶看簡報（25%）",
    shortDesc: "提供簡報並引薦洽談，其餘由阿男團隊執行",
    rate: 0.25,
    ratePct: 25,
  }),
  Object.freeze({
    id: "close_30",
    label: "帶單促成成交（30%）",
    shortDesc: "協助客戶拍板成交，工程與交付由阿男團隊處理",
    rate: 0.3,
    ratePct: 30,
  }),
  Object.freeze({
    id: "fulfill_35",
    label: "負責對客收海報素材（35%）",
    shortDesc: "負責對客戶溝通並收齊海報、價目與店面素材",
    rate: 0.35,
    ratePct: 35,
  }),
  Object.freeze({
    id: "fulfill_40",
    label: "對客收素材＋全程跟催（40%）",
    shortDesc: "全程對口收齊素材、核對上線與後續月維護跟催",
    rate: 0.4,
    ratePct: 40,
  }),
]);

export function sanitizeText(val, maxLen = 60) {
  return String(val ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

export function formatNtd(amount) {
  const n = Math.max(0, Math.round(Number(amount) || 0));
  return `NT$${n.toLocaleString("en-US")}`;
}

export function findPlan(planId) {
  return PLANS.find((p) => p.id === planId) || PLANS[2];
}

export function findAdjustment(adjustmentId) {
  return ADJUSTMENTS.find((a) => a.id === adjustmentId) || ADJUSTMENTS[0];
}

export function findPartnerTier(tierId) {
  return PARTNER_TIERS.find((t) => t.id === tierId) || PARTNER_TIERS[0];
}

/**
 * 精準計算：客戶實付金額、必要實支、合夥人分潤金額、阿男實拿淨利
 * 恆等式保證：directCost + partnerCommission + ananNetProfit === clientPayable
 */
export function calculateDealBreakdown({
  planId = "turnkey_25000",
  adjustmentId = "none",
  tierId = "intro_25",
  customDirectCost = undefined,
} = {}) {
  const plan = findPlan(planId);
  const adjustment = findAdjustment(adjustmentId);
  const tier = findPartnerTier(tierId);

  const basePrice = plan.price;
  let adjustmentAmount = 0;
  let adjustmentApplied = adjustment.id === "none";
  let adjustmentNote = "";

  if (adjustment.id === "credit_3800") {
    if (plan.supportsCredit3800) {
      adjustmentAmount = Math.min(basePrice, 3800);
      adjustmentApplied = true;
      adjustmentNote = "已套用 30 天內健檢 NT$3,800 全額折抵。";
    } else {
      adjustmentAmount = 0;
      adjustmentApplied = false;
      adjustmentNote = "「30 天內健檢全額折抵」僅適用於 NT$18,000 改造或 NT$25,000 一條龍升級專案，目前依原價試算。";
    }
  } else if (adjustment.id === "opening_90") {
    adjustmentAmount = Math.round(basePrice * 0.1);
    adjustmentApplied = true;
    adjustmentNote = `已套用合夥人開幕專案 9 折（減免 ${formatNtd(adjustmentAmount)}）。`;
  } else if (adjustment.id === "referral_2000") {
    if (plan.supportsReferral2000 && basePrice > 2000) {
      adjustmentAmount = 2000;
      adjustmentApplied = true;
      adjustmentNote = "已套用老客戶介紹減 NT$2,000。";
    } else {
      adjustmentAmount = 0;
      adjustmentApplied = false;
      adjustmentNote = "「老客戶介紹減 NT$2,000」限單次專案適用，每月維護方案維持原價試算。";
    }
  }

  const clientPayable = Math.max(0, basePrice - adjustmentAmount);

  let rawCost;
  if (customDirectCost === undefined || customDirectCost === null || customDirectCost === "") {
    rawCost = plan.defaultDirectCost;
  } else {
    const parsed = Number(customDirectCost);
    rawCost = Number.isFinite(parsed) ? parsed : plan.defaultDirectCost;
  }
  const directCost = Math.max(0, Math.min(clientPayable, Math.round(rawCost)));

  const distributableNet = Math.max(0, clientPayable - directCost);
  const partnerCommission = Math.round(distributableNet * tier.rate);
  const ananNetProfit = distributableNet - partnerCommission;

  return {
    plan,
    adjustment,
    tier,
    basePrice,
    adjustmentAmount,
    adjustmentApplied,
    adjustmentNote,
    clientPayable,
    directCost,
    distributableNet,
    partnerCommission,
    ananNetProfit,
    unitLabel: plan.unitLabel,
  };
}

/**
 * 產出給客戶的白話 LINE 報價文字（嚴格不含內部實支、合夥人分潤、阿男淨利與任何禁字）
 */
export function buildClientQuoteText({
  planId = "turnkey_25000",
  adjustmentId = "none",
  clientName = "",
  partnerName = "",
} = {}) {
  const result = calculateDealBreakdown({ planId, adjustmentId });
  const safeClient = sanitizeText(clientName, 40);
  const safePartner = sanitizeText(partnerName, 40);
  const greeting = safeClient ? `${safeClient} 老闆您好：` : "老闆您好：";

  const lines = [
    greeting,
    `整理您剛才詢問的【阿男 GEO｜${result.plan.name}】白話報價給您參考：`,
    "",
    `・方案內容：${result.plan.summary}`,
    `・標準定價：${formatNtd(result.basePrice)}${result.unitLabel}`,
  ];

  if (result.adjustmentApplied && result.adjustmentAmount > 0) {
    lines.push(`・專案減免：${result.adjustment.label}（折抵 ${formatNtd(result.adjustmentAmount)}）`);
    lines.push(`・實際應付金額：${formatNtd(result.clientPayable)}${result.unitLabel}`);
  } else {
    lines.push(`・實際應付金額：${formatNtd(result.clientPayable)}${result.unitLabel}`);
  }

  if (result.plan.id === "turnkey_25000") {
    lines.push("・主機託管說明：採 Cloudflare 免費空間 0 元主機月租，不綁每年高額主機續約費。");
  }
  if (result.plan.id === "audit_3800") {
    lines.push("・升級折抵說明：看過健檢實測報告後，30 天內決定升級改造可 100% 全額折抵 NT$3,800。");
  }

  lines.push("");
  if (safePartner) {
    lines.push(`服務協助窗口：${safePartner}`);
  }
  lines.push(`若確認啟動或想先看範例，歡迎直接回覆或加官方 LINE ${LINE_ID} 預約安排！`);

  return lines.join("\n");
}

/**
 * App 內全螢幕安全預覽視窗狀態控制器（使用 sandbox="allow-scripts" iframe[srcdoc] 隔離載入）
 */
export function createReportPreviewController({
  modalEl,
  titleEl,
  iframeEl,
  closeBtnEl,
  onToggleBodyClass,
} = {}) {
  let activeBrief = null;
  let lastTriggerEl = null;

  function open({ title = "老闆互動簡報預覽", html = "", filename = "geo-boss-brief.html", triggerEl = null } = {}) {
    if (!modalEl || !iframeEl || !html) return false;
    lastTriggerEl = triggerEl || null;
    activeBrief = {
      title: sanitizeText(title, 60) || "老闆互動簡報預覽",
      html: String(html),
      filename: String(filename || "geo-boss-brief.html"),
    };

    if (titleEl) {
      titleEl.textContent = activeBrief.title;
    }
    iframeEl.setAttribute("sandbox", "allow-scripts");
    iframeEl.setAttribute("srcdoc", activeBrief.html);
    modalEl.hidden = false;

    if (typeof onToggleBodyClass === "function") {
      onToggleBodyClass("preview-open", true);
    }
    if (closeBtnEl && typeof closeBtnEl.focus === "function") {
      closeBtnEl.focus();
    }
    return true;
  }

  function close() {
    if (!modalEl || !iframeEl) return;
    modalEl.hidden = true;
    if ("srcdoc" in iframeEl) {
      iframeEl.srcdoc = "";
    }
    iframeEl.removeAttribute("srcdoc");
    activeBrief = null;
    if (typeof onToggleBodyClass === "function") {
      onToggleBodyClass("preview-open", false);
    }
    if (lastTriggerEl && typeof lastTriggerEl.focus === "function") {
      lastTriggerEl.focus();
    }
    lastTriggerEl = null;
  }

  function isOpen() {
    return Boolean(modalEl && !modalEl.hidden);
  }

  function getActiveBrief() {
    return activeBrief ? { ...activeBrief } : null;
  }

  return {
    open,
    close,
    isOpen,
    getActiveBrief,
  };
}

if (typeof globalThis !== "undefined") {
  globalThis.AnanPricingCalc = {
    PLANS,
    ADJUSTMENTS,
    PARTNER_TIERS,
    sanitizeText,
    formatNtd,
    findPlan,
    findAdjustment,
    findPartnerTier,
    calculateDealBreakdown,
    buildClientQuoteText,
    createReportPreviewController,
  };
}
