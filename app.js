/* 阿男 GEO 實戰工坊 — 唯讀案例儀表板、12 題自檢表與互動控制器（零外部依賴） */
(() => {
  "use strict";

  const QUIZ_LAYERS = [
    { id: "access", name: "第 1 關｜訪問層", total: 3, advice: "先修第 1 關（靜態 HTML、robots.txt 放行搜尋爬蟲與舊測試域 308 轉址），否則 AI 連門都進不來。" },
    { id: "orientation", name: "第 2 關｜定向層", total: 3, advice: "先補第 2 關（乾淨 sitemap、唯一 canonical 與精簡有效 llms.txt），避免 AI 抓錯分身頁面。" },
    { id: "understanding", name: "第 3 關｜理解層", total: 3, advice: "補強第 3 關（全平台口徑一致＋單一 @graph JSON-LD 與可見文字一致），降低認錯品牌或報錯價機率。" },
    { id: "quotability", name: "第 4 關｜可引用層", total: 3, advice: "強化第 4 關（純文字價格對比表、首段直答邊界與獨立第三方回饋），讓 AI 敢把你寫進推薦名單。" },
  ];

  const INDUSTRY_COMPETITORS = [
    {
      id: "marketing",
      label: "行銷／SEO顧問",
      items: [
        {
          name: "awoo 阿物科技",
          url: "https://www.awoo.ai",
          note: "台灣 SEO 與行銷科技品牌官網參考",
        },
        {
          name: "Moz",
          url: "https://moz.com",
          note: "國際搜尋最佳化與知識內容標竿站",
        },
        {
          name: "Ahrefs",
          url: "https://ahrefs.com",
          note: "國際搜尋分析與內容佈局標竿站",
        },
      ],
    },
    {
      id: "ecommerce",
      label: "電商零售",
      items: [
        {
          name: "Pinkoi 設計購物網站",
          url: "https://www.pinkoi.com",
          note: "亞洲設計品牌電商平台參考",
        },
        {
          name: "PChome 24h 購物",
          url: "https://24h.pchome.com.tw",
          note: "台灣大型綜合電商入口參考",
        },
        {
          name: "博客來 Books",
          url: "https://www.books.com.tw",
          note: "內容型零售與商品頁結構標竿",
        },
      ],
    },
    {
      id: "medical",
      label: "醫美健康",
      items: [
        {
          name: "康健雜誌",
          url: "https://www.commonhealth.com.tw",
          note: "台灣健康衛教內容權威站參考",
        },
        {
          name: "早安健康",
          url: "https://www.edh.tw",
          note: "健康知識與結構化文章標竿",
        },
        {
          name: "長庚醫療財團法人",
          url: "https://www.cgmh.org.tw",
          note: "大型醫療機構公開官網參考",
        },
      ],
    },
    {
      id: "manufacturing",
      label: "B2B製造與供應鏈",
      items: [
        {
          name: "研華科技 Advantech",
          url: "https://www.advantech.com",
          note: "台灣工業物聯網與硬體規格站參考",
        },
        {
          name: "台達電子 Delta",
          url: "https://www.deltaww.com",
          note: "全球電源與工業自動化官網參考",
        },
        {
          name: "上銀科技 HIWIN",
          url: "https://www.hiwin.tw",
          note: "台灣精密機械與傳動零組件官網參考",
        },
      ],
    },
    {
      id: "b2b",
      label: "B2B企業服務",
      items: [
        {
          name: "Cloudflare",
          url: "https://www.cloudflare.com",
          note: "技術文件與企業官網結構標竿",
        },
        {
          name: "HubSpot",
          url: "https://www.hubspot.com",
          note: "B2B 內容集客與 Schema 標竿",
        },
        {
          name: "Stripe",
          url: "https://stripe.com",
          note: "開發者與企業服務說明頁標竿",
        },
      ],
    },
    {
      id: "local",
      label: "客製與在地品牌",
      items: [
        {
          name: "阿男音樂（cccnan.art）",
          url: "https://www.cccnan.art",
          note: "客製紀念歌曲品牌 GEO 改造第 1 號案例",
        },
        {
          name: "阿男 GEO 實戰工坊（anangeo.com）",
          url: "https://anangeo.com",
          note: "robots.txt＋llms.txt＋Schema 基準示範站",
        },
        {
          name: "微熱山丘 SunnyHills",
          url: "https://www.sunnyhills.com.tw",
          note: "台灣在地伴手禮品牌官網參考",
        },
      ],
    },
  ];

  const LEAD_UNLOCK_STORAGE_KEY = "anangeo_lead_unlocked_v1";

  function readSessionUnlock() {
    try {
      const raw = window.sessionStorage?.getItem(LEAD_UNLOCK_STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return Boolean(parsed && parsed.unlocked === true);
    } catch {
      return false;
    }
  }

  function saveSessionUnlock(email) {
    try {
      window.sessionStorage?.setItem(
        LEAD_UNLOCK_STORAGE_KEY,
        JSON.stringify({ unlocked: true, email, unlockedAt: new Date().toISOString() })
      );
    } catch {
      // 無痕模式或停用 sessionStorage 時安全略過
    }
  }

  const state = {
    caseData: null,
    activeEngine: "overview",
    activeDim: "crawlability",
    activeGuide: "all",
    activeIndustry: "marketing",
    selectedCompetitorUrl: "",
    selectedCompetitorName: "",
    liveChecking: false,
    leadSubmitting: false,
    leadUnlocked: readSessionUnlock(),
    lastLeadMessage: "",
    lastLiveReport: null,
    lastCompetitorReport: null,
    activeLineIndustry: "marketing",
    picker: {
      scale: "small",
      budget: "under5k",
      goal: "audit",
      applyCredit: true,
      recommendedLabel: "入門 01｜基礎 GEO 健檢（NT$3,800）",
    },
    starterCache: {
      robots: "",
      llms: "",
    },
  };

  const STARTER_INDUSTRY_TEMPLATES = {
    marketing: {
      label: "行銷／SEO顧問",
      defaultSummary: "提供網站搜尋能見度診斷、GEO 結構化改造與數據追蹤顧問服務。",
      defaultService: "基礎網站健檢與顧問專案（請填寫公開價格區間與交付工作天）",
      boundary: "不保證搜尋或 AI 必然排第一，以可驗證的公開實測紀錄與工程交付為主。",
      pages: [
        { path: "/services/", title: "服務方案與公開報價", desc: "方案比較表、交付項目與服務邊界" },
        { path: "/cases/", title: "公開實測案例", desc: "去敏前後對照數據與方法拆解" },
        { path: "/faq/", title: "常見問答（FAQ）", desc: "收費方式、工期與合作流程說明" },
        { path: "/contact/", title: "官方聯絡與預約", desc: "正式詢問管道與初次準備資料" },
      ],
    },
    ecommerce: {
      label: "電商零售",
      defaultSummary: "提供公開透明規格、保固條件與退換貨規則的線上品牌購物官網。",
      defaultService: "主力熱銷品項公開定價、運費門檻與售後保固說明",
      boundary: "所有庫存、售價與退換貨規範以本官網最新商品頁公告為準。",
      pages: [
        { path: "/products/", title: "主力商品分類與規格比較", desc: "純文字規格表、材質與適用情境" },
        { path: "/shipping-returns/", title: "出貨、運費與退換貨政策", desc: "配送天數與售後保固條款" },
        { path: "/faq/", title: "購買常見問答", desc: "尺寸挑選、發票與付款方式" },
        { path: "/contact/", title: "官方客服入口", desc: "唯一官方客服管道與服務時間" },
      ],
    },
    medical: {
      label: "醫美健康",
      defaultSummary: "提供經專業醫師審校之衛教資訊、療程流程與公開參考區間。",
      defaultService: "門診評估流程、衛教說明與合法公開參考資訊（依實際看診評估為準）",
      boundary: "所有醫療處置須經專業醫師親自面診評估，本網站不作醫療效果保證。",
      pages: [
        { path: "/treatments/", title: "主力項目與流程說明", desc: "適應對象、術前術後注意事項與合規邊界" },
        { path: "/doctors/", title: "醫師與專業團隊介紹", desc: "學經歷與專長領域核實資料" },
        { path: "/faq/", title: "就診常見問答", desc: "預約方式、評估流程與常見疑問" },
        { path: "/contact/", title: "診所交通與官方預約", desc: "門診時間與唯一官方預約管道" },
      ],
    },
    manufacturing: {
      label: "B2B製造與供應鏈",
      defaultSummary: "提供純文字產品型號規格、品質認證、MOQ 與交期說明之製造供應商官網。",
      defaultService: "主力產品型號規格表、最小訂購量（MOQ）、打樣週期與品質認證編號",
      boundary: "大量客製規格與海外運輸條件依正式報價單為準，本官網提供標準規格基準。",
      pages: [
        { path: "/products/", title: "產品型號與純文字規格表", desc: "材質、耐受度、料號與應用產業（非僅 PDF）" },
        { path: "/certifications/", title: "品質認證與檢驗標準", desc: "ISO／安規認證編號與品管流程" },
        { path: "/oem-odm/", title: "OEM／ODM 客製代工流程", desc: "MOQ、打樣天數與交期說明" },
        { path: "/contact/", title: "採購詢價與聯絡入口", desc: "業務窗口與索取規格表方式" },
      ],
    },
    b2b: {
      label: "B2B企業服務",
      defaultSummary: "提供企業軟體／顧問服務方案、計費單位、資安合規與整合規格說明。",
      defaultService: "公開版本方案比較、適用團隊規模、導入週期與資安 NDA 說明",
      boundary: "企業客製串接與進階授權依導入範圍報價，不任意誇大未實作功能。",
      pages: [
        { path: "/pricing/", title: "版本比較與公開計費", desc: "各方案席次、功能差異表與導入流程" },
        { path: "/security/", title: "資安合規與 NDA 承諾", desc: "資料隔離、權限控管與合規文件" },
        { path: "/integrations/", title: "系統整合與 API 說明", desc: "支援之外部工具與串接條件" },
        { path: "/contact/", title: "預約企業 Demo 與顧問諮詢", desc: "正式業務接洽入口" },
      ],
    },
    local: {
      label: "客製與在地品牌",
      defaultSummary: "提供清楚公開方案、製作流程、交期與唯一官方預約管道的獨立品牌官網。",
      defaultService: "公開主力方案價目表、製作工作天數與客製流程說明",
      boundary: "清楚標示不承接範圍與急件條件，所有聯絡以官網公告之唯一官方帳號為準。",
      pages: [
        { path: "/work/", title: "服務方案與公開價目表", desc: "各方案差異對照表與交付內容" },
        { path: "/portfolio/", title: "代表作品與客戶回饋", desc: "公開案例與真實製作流程紀錄" },
        { path: "/faq/", title: "訂購與製作常見問答", desc: "修改次數、交期與付款說明" },
        { path: "/contact/", title: "官方預約與聯絡方式", desc: "唯一官方帳號與初次詢問準備事項" },
      ],
    },
  };

  const INDUSTRY_BUYER_QUESTIONS = {
    marketing: {
      label: "行銷／SEO顧問",
      build: (brand, priceNote) => [
        {
          tag: "① 未提品牌推薦題",
          text: "台灣有哪些公開報價、願意交出原始實測證據的 SEO／GEO 顧問公司？中小企業該怎麼挑選才不會踩雷？",
        },
        {
          tag: "② 規格預算比較題",
          text: `如果預算抓在${priceNote || " NT$20,000～30,000 "}想做官網 AI 搜尋能見度健檢或地基改造，標準交付項目應該包含哪些？`,
        },
        {
          tag: "③ 品牌直問防誤報題",
          text: `想找「${brand}」做行銷或 GEO／SEO 顧問合作，公開方案價格、服務邊界與官方聯絡入口是什麼？`,
        },
      ],
    },
    ecommerce: {
      label: "電商零售",
      build: (brand, priceNote) => [
        {
          tag: "① 未提品牌推薦題",
          text: "台灣有哪些規格透明、售後保固清楚且評價穩定的網路品牌可以推薦？挑選時要注意哪些地雷？",
        },
        {
          tag: "② 規格預算比較題",
          text: `預算${priceNote || " NT$1,000～5,000 "}挑選這類商品時，應該怎麼比較材質規格、保固期限與退換貨條件？`,
        },
        {
          tag: "③ 品牌直問防誤報題",
          text: `在「${brand}」官網購買主力商品的公開售價區間、運費門檻、退換貨規定與官方客服聯絡方式是什麼？`,
        },
      ],
    },
    medical: {
      label: "醫美健康",
      build: (brand, priceNote) => [
        {
          tag: "① 未提品牌推薦題",
          text: "台灣有哪些重視醫師親自評估、流程透明且衛教資訊完整的健康／醫美診所可以參考？初診前該確認什麼？",
        },
        {
          tag: "② 規格預算比較題",
          text: `想了解這類療程或健檢項目的常見評估流程、恢復期差異與公開參考費用區間（例如${priceNote || " NT$5,000～30,000"}）該怎麼比較？`,
        },
        {
          tag: "③ 品牌直問防誤報題",
          text: `想去「${brand}」預約門診評估，公開提供的項目說明、注意事項與唯一官方預約管道是什麼？`,
        },
      ],
    },
    manufacturing: {
      label: "B2B製造與供應鏈",
      build: (brand, priceNote) => [
        {
          tag: "① 未提品牌推薦題",
          text: "台灣有哪些公開產品規格、具備品質認證且支援中小量客製（OEM／ODM）的製造供應商？採購評估該看哪些指標？",
        },
        {
          tag: "② 規格預算比較題",
          text: `採購這類工業零件或客製代工時，常見的最小訂購量（MOQ）、打樣交期與價格區間（${priceNote || "依規格階梯報價"}）該如何比較？`,
        },
        {
          tag: "③ 品牌直問防誤報題",
          text: `「${brand}」主力產品型號、品質認證編號、MOQ／交期條件以及採購詢價的官方窗口是什麼？`,
        },
      ],
    },
    b2b: {
      label: "B2B企業服務",
      build: (brand, priceNote) => [
        {
          tag: "① 未提品牌推薦題",
          text: "台灣有哪些適合中小與成長型企業、定價透明且重視資安保密的 B2B 軟體或企業顧問服務？選型時要比較什麼？",
        },
        {
          tag: "② 規格預算比較題",
          text: `企業導入這類系統或顧問服務，若預算落在${priceNote || " NT$25,000／月起或單次專案 "}，該怎麼比較席次計費、導入天數與 NDA 資安承諾？`,
        },
        {
          tag: "③ 品牌直問防誤報題",
          text: `「${brand}」目前公開的企業方案費用、包含功能、不適用範圍與預約 Demo 的官方聯絡入口是什麼？`,
        },
      ],
    },
    local: {
      label: "客製與在地品牌",
      build: (brand, priceNote) => [
        {
          tag: "① 未提品牌推薦題",
          text: "台灣有哪些全程溝通透明、公開方案價目且作品案例真實可查的客製服務或在地特色品牌？挑選時該看哪幾點？",
        },
        {
          tag: "② 規格預算比較題",
          text: `預算約${priceNote || " NT$3,500～10,000 "}想委託客製服務，不同價位方案在交付內容、修改次數與工作天數上差在哪？`,
        },
        {
          tag: "③ 品牌直問防誤報題",
          text: `想向「${brand}」預約或委託客製服務，最新公開價格、流程步驟與唯一官方 LINE／聯絡入口是什麼？`,
        },
      ],
    },
  };

  const RING_CIRCUMFERENCE = 2 * Math.PI * 50; // r=50 -> 314.159...

  const LIGHT_TEXT = {
    green: "綠燈",
    yellow: "黃燈",
    red: "紅燈",
    idle: "待檢測",
  };

  function getHostLabel(urlStr) {
    try {
      return new URL(urlStr).hostname;
    } catch {
      return String(urlStr || "—");
    }
  }

  function truncateText(text, maxLen = 90) {
    if (!text) return "";
    const str = String(text).trim();
    return str.length > maxLen ? `${str.slice(0, maxLen)}…` : str;
  }

  function makeKvRow(label, value) {
    const row = document.createElement("div");
    row.className = "check-kv";
    const k = document.createElement("span");
    k.className = "check-kv-label";
    k.textContent = label;
    const v = document.createElement("span");
    v.className = "check-kv-val";
    v.textContent = value;
    row.append(k, v);
    return row;
  }

  function setLiveStatus(message, mode = "idle") {
    const statusNode = el("live-check-status");
    if (!statusNode) return;
    statusNode.textContent = message;
    statusNode.className = "live-check-status";
    if (mode && mode !== "idle") {
      statusNode.classList.add(`is-${mode}`);
    }
  }

  function setLeadStatus(message, mode = "idle") {
    const statusNode = el("live-lead-status");
    if (!statusNode) return;
    statusNode.textContent = message;
    statusNode.className = "lead-form-status";
    if (mode && mode !== "idle") {
      statusNode.classList.add(`is-${mode}`);
    }
  }

  function applyCardLight(card, light, kickerText, summaryText, detailNodes) {
    if (!card) return;
    card.className = `check-light-card is-${light || "idle"}`;
    const kicker = card.querySelector(".check-card-kicker");
    const badge = card.querySelector(".light-badge");
    const summary = card.querySelector(".check-card-summary");
    const details = card.querySelector(".check-card-details");

    if (kicker) kicker.textContent = kickerText;
    if (badge) {
      badge.className = `light-badge is-${light || "idle"}`;
      badge.textContent = LIGHT_TEXT[light] || LIGHT_TEXT.idle;
    }
    if (summary) summary.textContent = summaryText;
    if (details) {
      clearNode(details);
      detailNodes.forEach((node) => details.appendChild(node));
    }
  }

  function renderScoreRing(ringFillId, scoreValueId, score, gradeLight) {
    const clamped = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
    const scoreNode = el(scoreValueId);
    if (scoreNode) scoreNode.textContent = String(clamped);

    const ringFill = el(ringFillId);
    if (ringFill) {
      const offset = RING_CIRCUMFERENCE * (1 - clamped / 100);
      ringFill.setAttribute("stroke-dasharray", RING_CIRCUMFERENCE.toFixed(2));
      ringFill.setAttribute("stroke-dashoffset", offset.toFixed(2));
      ringFill.setAttribute("class", `score-ring-fill is-${gradeLight || "red"}`);
    }
  }

  function renderPkBreakdownTable(report, compReport) {
    const box = el("live-pk-breakdown");
    const tbody = el("live-pk-breakdown-body");
    if (!box || !tbody) return;

    if (!compReport) {
      box.hidden = true;
      clearNode(tbody);
      return;
    }

    const myHost = getHostLabel(report.target_url);
    const compHost = getHostLabel(compReport.target_url);

    const thMine = el("pk-th-mine");
    const thComp = el("pk-th-comp");
    const meta = el("live-pk-breakdown-meta");
    if (thMine) thMine.textContent = `我方（${myHost}）`;
    if (thComp) thComp.textContent = `對手（${compHost}）`;
    if (meta) meta.textContent = `${myHost} vs ${compHost}`;

    clearNode(tbody);
    const rows = [
      { key: "robots", label: "01｜AI 爬蟲放行（robots.txt）", max: 35 },
      { key: "llms", label: "02｜AI 導覽索引（llms.txt）", max: 30 },
      { key: "homepage", label: "03｜官網結構與標籤（首頁 HTML / JSON-LD）", max: 35 },
    ];

    rows.forEach((rowDef) => {
      const myItem = report.checks?.[rowDef.key];
      const compItem = compReport.checks?.[rowDef.key];
      const myScore = Number(myItem?.score ?? 0);
      const compScore = Number(compItem?.score ?? 0);
      const diff = myScore - compScore;

      const tr = document.createElement("tr");

      const tdLabel = document.createElement("td");
      tdLabel.className = "pk-cell-dim";
      tdLabel.setAttribute("data-label", "檢測維度");
      tdLabel.textContent = rowDef.label;

      const tdMine = document.createElement("td");
      tdMine.className = "mono pk-cell-score";
      tdMine.setAttribute("data-label", `我方 (${myHost})`);
      tdMine.textContent = `${myScore} / ${myItem?.max_score ?? rowDef.max}（${LIGHT_TEXT[myItem?.light] || ""}）`;

      const tdComp = document.createElement("td");
      tdComp.className = "mono pk-cell-score";
      tdComp.setAttribute("data-label", `對手 (${compHost})`);
      tdComp.textContent = `${compScore} / ${compItem?.max_score ?? rowDef.max}（${LIGHT_TEXT[compItem?.light] || ""}）`;

      const tdDiff = document.createElement("td");
      tdDiff.className = "pk-cell-diff";
      tdDiff.setAttribute("data-label", "差距");
      const tag = document.createElement("span");
      tag.className = `pk-diff-tag ${diff > 0 ? "is-win" : diff < 0 ? "is-lose" : "is-tie"}`;
      tag.textContent = diff > 0 ? `領先 +${diff}` : diff < 0 ? `落後 ${Math.abs(diff)}` : "平手 0";
      tdDiff.appendChild(tag);

      tr.append(tdLabel, tdMine, tdComp, tdDiff);
      tbody.appendChild(tr);
    });

    // 第 4 列：台灣網站 4 大常犯錯檢查通過數 PK
    const myPitfalls = Array.isArray(report.checks?.homepage?.pitfall_checks)
      ? report.checks.homepage.pitfall_checks
      : [];
    const compPitfalls = Array.isArray(compReport.checks?.homepage?.pitfall_checks)
      ? compReport.checks.homepage.pitfall_checks
      : [];
    if (myPitfalls.length > 0 || compPitfalls.length > 0) {
      const myPass = myPitfalls.filter((p) => p.passed).length;
      const compPass = compPitfalls.filter((p) => p.passed).length;
      const pDiff = myPass - compPass;

      const tr = document.createElement("tr");
      const tdLabel = document.createElement("td");
      tdLabel.className = "pk-cell-dim";
      tdLabel.setAttribute("data-label", "檢測維度");
      tdLabel.textContent = "04｜首頁 4 大常犯錯檢查（唯一 H1／比較表／無壞描述／FAQPage）";

      const tdMine = document.createElement("td");
      tdMine.className = "mono pk-cell-score";
      tdMine.setAttribute("data-label", `我方 (${myHost})`);
      tdMine.textContent = `通過 ${myPass} / 4 項`;

      const tdComp = document.createElement("td");
      tdComp.className = "mono pk-cell-score";
      tdComp.setAttribute("data-label", `對手 (${compHost})`);
      tdComp.textContent = `通過 ${compPass} / 4 項`;

      const tdDiff = document.createElement("td");
      tdDiff.className = "pk-cell-diff";
      tdDiff.setAttribute("data-label", "差距");
      const tag = document.createElement("span");
      tag.className = `pk-diff-tag ${pDiff > 0 ? "is-win" : pDiff < 0 ? "is-lose" : "is-tie"}`;
      tag.textContent = pDiff > 0 ? `領先 +${pDiff} 項` : pDiff < 0 ? `落後 ${Math.abs(pDiff)} 項` : "平手 0";
      tdDiff.appendChild(tag);

      tr.append(tdLabel, tdMine, tdComp, tdDiff);
      tbody.appendChild(tr);
    }

    box.hidden = false;
  }

  function syncDetailLockVisibility() {
    const unlockGate = el("live-unlock-gate");
    const detailWrap = el("live-detail-wrap");
    const unlockedBanner = el("live-unlocked-banner");
    const unlockedMsg = el("live-unlocked-msg");
    const pkBreakdown = el("live-pk-breakdown");

    if (!state.lastLiveReport) {
      if (unlockGate) unlockGate.hidden = true;
      if (detailWrap) detailWrap.hidden = false;
      if (unlockedBanner) unlockedBanner.hidden = true;
      if (pkBreakdown) pkBreakdown.hidden = true;
      return;
    }

    if (state.leadUnlocked) {
      if (unlockGate) unlockGate.hidden = true;
      if (detailWrap) detailWrap.hidden = false;
      if (unlockedBanner) {
        unlockedBanner.hidden = false;
        if (unlockedMsg) {
          unlockedMsg.textContent =
            state.lastLeadMessage ||
            "本次瀏覽已自動記住解鎖狀態，可直接檢視完整三項紅綠燈明細與白話修復建議。";
        }
      }
      if (pkBreakdown) {
        pkBreakdown.hidden = !state.lastCompetitorReport;
      }
    } else {
      if (unlockGate) unlockGate.hidden = false;
      if (detailWrap) detailWrap.hidden = true;
      if (unlockedBanner) unlockedBanner.hidden = true;
    }
  }

  function renderLiveCheckResult(report, competitorReport = null) {
    state.lastLiveReport = report;
    state.lastCompetitorReport = competitorReport || null;

    const score = Number.isFinite(report.score) ? Math.max(0, Math.min(100, report.score)) : 0;
    const gradeLight = report.grade_light || "red";
    const myHost = getHostLabel(report.target_url);

    renderScoreRing("live-score-ring-fill", "live-score-value", score, gradeLight);

    const primaryHostNode = el("live-primary-host");
    if (primaryHostNode) primaryHostNode.textContent = myHost;

    const gradeBadge = el("live-grade-badge");
    if (gradeBadge) {
      const pillClass =
        gradeLight === "green" ? "pill-teal" : gradeLight === "yellow" ? "pill-brass" : "pill-coral";
      gradeBadge.className = `pill ${pillClass}`;
      gradeBadge.textContent = `${LIGHT_TEXT[gradeLight] || "實測"}｜${score} / 100 分`;
    }

    const targetDisplay = el("live-target-display");
    if (targetDisplay) {
      const sec = ((report.elapsed_ms || 0) / 1000).toFixed(1);
      targetDisplay.textContent = competitorReport
        ? `${myHost} vs ${getHostLabel(competitorReport.target_url)}`
        : `${report.target_url}（耗時 ${sec} 秒）`;
    }

    // PK 總覽（雙環形圖 + 勝負差距）
    const overviewEl = el("live-score-overview");
    const pkVersusEl = el("live-pk-versus");
    const compSideEl = el("live-comp-side");

    if (competitorReport) {
      const compScore = Number.isFinite(competitorReport.score)
        ? Math.max(0, Math.min(100, competitorReport.score))
        : 0;
      const compLight = competitorReport.grade_light || "red";
      const compHost = getHostLabel(competitorReport.target_url);
      const diff = score - compScore;

      if (overviewEl) overviewEl.classList.add("is-pk");
      if (compSideEl) compSideEl.hidden = false;
      renderScoreRing("live-comp-score-ring-fill", "live-comp-score-value", compScore, compLight);

      const compHostNode = el("live-comp-host");
      if (compHostNode) compHostNode.textContent = compHost;

      const compBadge = el("live-comp-grade-badge");
      if (compBadge) {
        const compPillClass =
          compLight === "green" ? "pill-teal" : compLight === "yellow" ? "pill-brass" : "pill-coral";
        compBadge.className = `pill ${compPillClass} score-side-pill`;
        compBadge.textContent = `${LIGHT_TEXT[compLight] || "實測"}｜${compScore} / 100`;
      }

      if (pkVersusEl) {
        pkVersusEl.hidden = false;
        pkVersusEl.className = `pk-versus-box ${diff > 0 ? "is-win" : diff < 0 ? "is-lose" : "is-tie"}`;

        const diffBadge = el("live-pk-diff-badge");
        const verdictEl = el("live-pk-verdict");
        const subEl = el("live-pk-sub");

        if (diff > 0) {
          if (diffBadge) diffBadge.textContent = `領先 +${diff} 分`;
          if (verdictEl) verdictEl.textContent = `我方領先對手 ${diff} 分（${score} vs ${compScore}）`;
          if (subEl) subEl.textContent = `${myHost} 基礎地基表現優於 ${compHost}，解鎖下方明細可查看各分項優勢與還可補強之處。`;
        } else if (diff < 0) {
          const behind = Math.abs(diff);
          if (diffBadge) diffBadge.textContent = `落後 -${behind} 分`;
          if (verdictEl) verdictEl.textContent = `我方落後對手 ${behind} 分（${score} vs ${compScore}）`;
          if (subEl) subEl.textContent = `${compHost} 目前基礎分數較高，立即解鎖下方明細即可對照落後哪幾項與優先修補順序。`;
        } else {
          if (diffBadge) diffBadge.textContent = "平手 0 分差";
          if (verdictEl) verdictEl.textContent = `雙方基礎總分平手（${score} vs ${compScore}）`;
          if (subEl) subEl.textContent = `${myHost} 與 ${compHost} 基礎總分相同，解鎖下方三項明細即可比對細部差異。`;
        }
      }
    } else {
      if (overviewEl) overviewEl.classList.remove("is-pk");
      if (pkVersusEl) pkVersusEl.hidden = true;
      if (compSideEl) compSideEl.hidden = true;
    }

    const headline = el("live-grade-headline");
    if (headline) headline.textContent = report.grade_label || "已完成公開頁基礎初檢";

    const metaNote = el("live-meta-note");
    if (metaNote) {
      const robots = report.checks?.robots;
      const llms = report.checks?.llms;
      const home = report.checks?.homepage;
      metaNote.textContent = state.leadUnlocked
        ? `我方分項得分：robots.txt ${robots?.score ?? 0}/${robots?.max_score ?? 35}、llms.txt ${llms?.score ?? 0}/${llms?.max_score ?? 30}、首頁結構 ${home?.score ?? 0}/${home?.max_score ?? 35}。`
        : "總分已出爐！輸入下方 Email 即可免費展開三項紅綠燈細節、爬蟲清單與白話修復建議。";
    }

    // 逐項 PK 對比表
    renderPkBreakdownTable(report, competitorReport);

    // Card 1: robots.txt
    const robots = report.checks?.robots;
    if (robots) {
      const card = document.querySelector('[data-check-card="robots"]');
      const details = [];
      const httpLabel = robots.http_status ? `HTTP ${robots.http_status}` : "無法讀取";
      details.push(makeKvRow("狀態與搜尋爬蟲", `${httpLabel}｜放行 ${robots.search_bots_allowed ?? "—"}/${robots.search_bots_total ?? 6}`));

      if (Array.isArray(robots.search_bots) && robots.search_bots.length > 0) {
        const chipRow = document.createElement("div");
        chipRow.className = "bot-chip-list";
        robots.search_bots.forEach((item) => {
          const chip = document.createElement("span");
          chip.className = "bot-chip";
          if (item.allowed === true) {
            chip.classList.add("is-allow");
            chip.textContent = `✓ ${item.bot}`;
          } else if (item.allowed === false) {
            chip.classList.add("is-block");
            chip.textContent = `✕ ${item.bot}`;
          } else {
            chip.textContent = `? ${item.bot}`;
          }
          chipRow.appendChild(chip);
        });
        details.push(chipRow);
      }

      const trainText = robots.training_distinguished
        ? robots.training_bots
            .map((b) => `${b.bot}：${b.allowed === false ? "封鎖" : b.allowed === true ? "放行" : "未設"}`)
            .join("｜")
        : "尚未於 robots.txt 單獨區分 GPTBot／ClaudeBot";
      details.push(makeKvRow("訓練爬蟲分流", trainText));

      applyCardLight(
        card,
        robots.light,
        `01｜${robots.score} / ${robots.max_score} 分`,
        robots.summary,
        details
      );
    }

    // Card 2: llms.txt
    const llms = report.checks?.llms;
    if (llms) {
      const card = document.querySelector('[data-check-card="llms"]');
      const details = [];
      const statusText = llms.http_status ? `HTTP ${llms.http_status}` : "無法讀取";
      const typeText = llms.is_html_misleading
        ? "HTML 誤導頁（軟 404）"
        : llms.valid_plain_text
          ? "有效純文字索引"
          : "未設置／無法讀取";
      details.push(makeKvRow("HTTP 狀態與格式", `${statusText}｜${typeText}`));
      details.push(
        makeKvRow(
          "內容長度",
          llms.valid_plain_text ? `${Number(llms.content_length || 0).toLocaleString("en-US")} 字元` : "無法讀取／未設置"
        )
      );
      applyCardLight(
        card,
        llms.light,
        `02｜${llms.score} / ${llms.max_score} 分`,
        llms.summary,
        details
      );
    }

    // Card 3: homepage HTML
    const home = report.checks?.homepage;
    if (home) {
      const card = document.querySelector('[data-check-card="homepage"]');
      const details = [];
      details.push(makeKvRow("HTTP 狀態", home.http_status ? `HTTP ${home.http_status}` : "無法讀取"));
      details.push(makeKvRow("<title>", home.title ? truncateText(home.title, 56) : "未設置／無法讀取"));
      details.push(
        makeKvRow(
          "meta description",
          home.description ? truncateText(home.description, 64) : "未設置／無法讀取"
        )
      );
      details.push(
        makeKvRow(
          "canonical",
          home.canonical ? truncateText(home.canonical, 64) : "未設置／無法讀取"
        )
      );
      details.push(
        makeKvRow(
          "JSON-LD Schema",
          home.json_ld_count > 0 ? `共 ${home.json_ld_count} 組（${home.schema_types.length} 種 @type）` : "未設置（0 組）"
        )
      );

      if (Array.isArray(home.schema_types) && home.schema_types.length > 0) {
        const chipRow = document.createElement("div");
        chipRow.className = "bot-chip-list";
        home.schema_types.slice(0, 8).forEach((t) => {
          const chip = document.createElement("span");
          chip.className = "bot-chip is-schema";
          chip.textContent = t;
          chipRow.appendChild(chip);
        });
        details.push(chipRow);
      }

      if (Array.isArray(home.pitfall_checks) && home.pitfall_checks.length > 0) {
        const pitPass = home.pitfall_checks.filter((p) => p.passed).length;
        details.push(makeKvRow("4 大高引用地雷檢查", `通過 ${pitPass} / ${home.pitfall_checks.length} 項`));
        const pitRow = document.createElement("div");
        pitRow.className = "bot-chip-list pitfall-chip-list";
        home.pitfall_checks.forEach((item) => {
          const chip = document.createElement("span");
          chip.className = `bot-chip ${item.passed ? "is-allow" : "is-block"}`;
          chip.textContent = `${item.passed ? "✓" : "✕"} ${item.label.replace(/<[^>]+>/g, (m) => m)}：${item.detail}`;
          pitRow.appendChild(chip);
        });
        details.push(pitRow);
      }

      applyCardLight(
        card,
        home.light,
        `03｜${home.score} / ${home.max_score} 分`,
        home.summary,
        details
      );
    }

    // 同步將測驗結果帶入「半套起手檔產生器」與「30 秒 LINE 3 題小幫手」
    syncLiveReportToTools(report);

    // Recommendations
    const recsNode = el("live-check-recs");
    if (recsNode) {
      clearNode(recsNode);
      const recs = Array.isArray(report.recommendations) ? report.recommendations : [];
      recs.forEach((rec) => {
        const li = document.createElement("li");
        li.textContent = rec;
        recsNode.appendChild(li);
      });
    }

    // Disclaimer
    const disclaimerNode = el("live-check-disclaimer");
    if (disclaimerNode && report.disclaimer) {
      disclaimerNode.textContent = `免責聲明：${report.disclaimer}`;
    }

    const copyFb = el("live-copy-feedback");
    if (copyFb) copyFb.textContent = "";

    syncDetailLockVisibility();
  }

  async function fetchSingleCheck(targetUrl) {
    const resp = await fetch(`/api/check?url=${encodeURIComponent(targetUrl)}`, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    let payload = null;
    try {
      payload = await resp.json();
    } catch {
      payload = null;
    }
    if (!resp.ok || !payload || payload.ok !== true) {
      const msg =
        payload?.error ||
        `初檢服務暫時無法使用（HTTP ${resp.status}），請稍後再試或直接加 LINE @250ruauk 由真人協助診斷。`;
      return { ok: false, error: msg };
    }
    return { ok: true, data: payload };
  }

  async function runLiveCheck(rawUrl, rawCompetitorUrl) {
    if (state.liveChecking) return;
    const input = el("live-check-url");
    const compInput = el("live-competitor-url");
    const submitBtn = el("live-check-submit");

    const target = String(rawUrl ?? input?.value ?? "").trim();
    const competitor = String(rawCompetitorUrl ?? compInput?.value ?? "").trim();

    if (!target) {
      setLiveStatus("請先輸入欲檢測的公開網站網址（例如 https://anangeo.com）。", "error");
      if (input) input.focus();
      return;
    }

    if (input) input.value = target;
    if (compInput) compInput.value = competitor;

    state.liveChecking = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = competitor ? "雙站 PK 中..." : "檢測中...";
    }
    setLiveStatus(
      competitor
        ? `正在平行實測我方（${target}）與同行對手（${competitor}）的 robots.txt、llms.txt 與首頁結構，請稍候...`
        : `正在即時檢測 ${target} 的 robots.txt、llms.txt 與首頁結構，請稍候...`,
      "loading"
    );

    try {
      const tasks = [fetchSingleCheck(target)];
      if (competitor) tasks.push(fetchSingleCheck(competitor));

      const results = await Promise.all(tasks);
      const primaryRes = results[0];
      const compRes = competitor ? results[1] : null;

      if (!primaryRes.ok) {
        setLiveStatus(`我方網址檢測失敗：${primaryRes.error}`, "error");
        return;
      }

      if (compRes && !compRes.ok) {
        setLiveStatus(`對手網址檢測失敗：${compRes.error}`, "error");
        return;
      }

      const primaryReport = primaryRes.data;
      const compReport = compRes ? compRes.data : null;

      renderLiveCheckResult(primaryReport, compReport);
      setLeadStatus("", "idle");

      if (compReport) {
        const diff = primaryReport.score - compReport.score;
        const diffText = diff > 0 ? `我方領先 +${diff} 分` : diff < 0 ? `我方落後 ${Math.abs(diff)} 分` : "雙方平手";
        setLiveStatus(
          `已完成同行 PK：我方 ${primaryReport.score} 分 vs 對手 ${compReport.score} 分（${diffText}）。${state.leadUnlocked ? "完整明細已展開。" : "請在下方填入 Email 免費解鎖完整紅綠燈明細！"}`,
          "success"
        );
      } else {
        setLiveStatus(
          `已完成 ${primaryReport.target_url} 基礎 GEO 初檢：${primaryReport.score} / 100 分（${LIGHT_TEXT[primaryReport.grade_light] || ""}）。${state.leadUnlocked ? "完整明細已展開。" : "請在下方填入 Email 免費解鎖完整紅綠燈明細！"}`,
          "success"
        );
      }
    } catch {
      setLiveStatus(
        "連線至 /api/check 失敗，請確認網路連線正常；若需人工協助，歡迎加官方 LINE @250ruauk。",
        "error"
      );
    } finally {
      state.liveChecking = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "開始免費初檢";
      }
    }
  }

  function compactReportForLead(report) {
    if (!report) return null;
    return {
      target_url: report.target_url,
      score: report.score,
      grade_light: report.grade_light,
      grade_label: report.grade_label,
      checks: {
        robots: report.checks?.robots
          ? {
              score: report.checks.robots.score,
              max_score: report.checks.robots.max_score,
              light: report.checks.robots.light,
              summary: report.checks.robots.summary,
            }
          : null,
        llms: report.checks?.llms
          ? {
              score: report.checks.llms.score,
              max_score: report.checks.llms.max_score,
              light: report.checks.llms.light,
              summary: report.checks.llms.summary,
            }
          : null,
        homepage: report.checks?.homepage
          ? {
              score: report.checks.homepage.score,
              max_score: report.checks.homepage.max_score,
              light: report.checks.homepage.light,
              summary: report.checks.homepage.summary,
            }
          : null,
      },
      recommendations: Array.isArray(report.recommendations) ? report.recommendations.slice(0, 6) : [],
    };
  }

  async function handleLeadSubmit(ev) {
    ev.preventDefault();
    if (state.leadSubmitting) return;

    const emailInput = el("live-lead-email");
    const consentInput = el("live-lead-consent");
    const submitBtn = el("live-lead-submit");

    const email = String(emailInput?.value || "").trim();
    const consent = Boolean(consentInput?.checked);

    if (!state.lastLiveReport) {
      setLeadStatus("請先執行一次免費初檢，再解鎖完整報告。", "error");
      return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setLeadStatus("請輸入正確的 Email 信箱格式。", "error");
      if (emailInput) emailInput.focus();
      return;
    }

    if (!consent) {
      setLeadStatus("請先勾選「同意由阿男 GEO 實戰工坊寄送檢測報告與後續 GEO 實戰資訊」才能解鎖。", "error");
      if (consentInput) consentInput.focus();
      return;
    }

    state.leadSubmitting = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "解鎖中...";
    }
    setLeadStatus("正在解鎖完整紅綠燈明細與修復建議...", "idle");

    try {
      const payload = {
        email,
        consent: true,
        target_url: state.lastLiveReport.target_url,
        competitor_url: state.lastCompetitorReport?.target_url || "",
        score: state.lastLiveReport.score,
        competitor_score: state.lastCompetitorReport ? state.lastCompetitorReport.score : null,
        report: compactReportForLead(state.lastLiveReport),
        competitor_report: compactReportForLead(state.lastCompetitorReport),
      };

      const resp = await fetch("/api/lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      let data = null;
      try {
        data = await resp.json();
      } catch {
        data = null;
      }

      if (!resp.ok || !data || data.ok !== true || data.unlocked !== true) {
        setLeadStatus(data?.error || `送出失敗（HTTP ${resp.status}），請檢查信箱與勾選狀態後再試。`, "error");
        return;
      }

      state.leadUnlocked = true;
      state.lastLeadMessage =
        data.message ||
        (data.mail_sent
          ? "完整報告已解鎖並寄送至您的信箱！歡迎加官方 LINE @250ruauk 預約深度健檢。"
          : "完整報告已為您免費解鎖！歡迎加官方 LINE @250ruauk 預約完整 20 題與 9 維度健檢。");
      saveSessionUnlock(email);

      const metaNote = el("live-meta-note");
      if (metaNote && state.lastLiveReport?.checks) {
        const { robots, llms, homepage } = state.lastLiveReport.checks;
        metaNote.textContent = `我方分項得分：robots.txt ${robots?.score ?? 0}/${robots?.max_score ?? 35}、llms.txt ${llms?.score ?? 0}/${llms?.max_score ?? 30}、首頁結構 ${homepage?.score ?? 0}/${homepage?.max_score ?? 35}。`;
      }

      syncDetailLockVisibility();
      setLeadStatus(state.lastLeadMessage, "success");
    } catch {
      setLeadStatus("連線至 /api/lead 失敗，請確認網路連線正常後再試。", "error");
    } finally {
      state.leadSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "立即免費解鎖完整報告";
      }
    }
  }

  function normalizeUrlCompare(raw) {
    const trimmed = String(raw || "").trim();
    if (!trimmed) return "";
    try {
      const u = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
      return `${u.origin}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
    } catch {
      return trimmed.replace(/\/+$/, "").toLowerCase();
    }
  }

  function findIndustryCompetitorByUrl(urlStr) {
    const key = normalizeUrlCompare(urlStr);
    if (!key) return null;
    for (const group of INDUSTRY_COMPETITORS) {
      for (const item of group.items) {
        if (normalizeUrlCompare(item.url) === key) {
          return { ...item, industryId: group.id, industryLabel: group.label };
        }
      }
    }
    return null;
  }

  function updateSelectedCompetitorSummary() {
    const summaryEl = el("selected-competitor-summary");
    const clearBtn = el("clear-competitor-btn");
    const compInput = el("live-competitor-url");
    const manualVal = String(compInput?.value || "").trim();

    if (state.selectedCompetitorUrl) {
      if (summaryEl) {
        summaryEl.className = "selected-comp-pill is-selected";
        summaryEl.textContent = `已勾選 PK 對手：${state.selectedCompetitorName || getHostLabel(state.selectedCompetitorUrl)}（${state.selectedCompetitorUrl}）`;
      }
      if (clearBtn) {
        clearBtn.hidden = false;
        clearBtn.textContent = "取消勾選";
      }
      return;
    }

    if (manualVal) {
      if (summaryEl) {
        summaryEl.className = "selected-comp-pill is-manual";
        summaryEl.textContent = `已自行輸入 PK 對手：${manualVal}`;
      }
      if (clearBtn) {
        clearBtn.hidden = false;
        clearBtn.textContent = "清除對手";
      }
      return;
    }

    if (summaryEl) {
      summaryEl.className = "selected-comp-pill";
      summaryEl.textContent = "未選對手（僅測自己網站）";
    }
    if (clearBtn) {
      clearBtn.hidden = true;
    }
  }

  function renderIndustryCompetitors(industryId) {
    const group =
      INDUSTRY_COMPETITORS.find((g) => g.id === industryId) || INDUSTRY_COMPETITORS[0];
    if (!group) return;
    state.activeIndustry = group.id;

    document.querySelectorAll("#industry-tabs [data-industry]").forEach((btn) => {
      const active = btn.getAttribute("data-industry") === group.id;
      btn.setAttribute("aria-selected", String(active));
      btn.classList.toggle("is-active", active);
    });

    const grid = el("industry-competitor-grid");
    if (!grid) return;
    clearNode(grid);

    const selectedKey = normalizeUrlCompare(state.selectedCompetitorUrl);

    group.items.forEach((item) => {
      const isChecked = Boolean(selectedKey && normalizeUrlCompare(item.url) === selectedKey);

      const label = document.createElement("label");
      label.className = `competitor-card${isChecked ? " is-checked" : ""}`;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "competitor-card-checkbox";
      checkbox.name = "industry_competitor";
      checkbox.value = item.url;
      checkbox.checked = isChecked;
      checkbox.setAttribute("data-competitor-name", item.name);

      const body = document.createElement("span");
      body.className = "competitor-card-body";

      const top = document.createElement("span");
      top.className = "competitor-card-top";

      const nameEl = document.createElement("strong");
      nameEl.className = "competitor-card-name";
      nameEl.textContent = item.name;

      const stateTag = document.createElement("span");
      stateTag.className = "competitor-card-state";
      stateTag.textContent = isChecked ? "已勾選 PK" : "未勾選";

      top.append(nameEl, stateTag);

      const urlEl = document.createElement("code");
      urlEl.className = "competitor-card-url";
      urlEl.textContent = item.url;

      const noteEl = document.createElement("span");
      noteEl.className = "competitor-card-note";
      noteEl.textContent = item.note;

      body.append(top, urlEl, noteEl);
      label.append(checkbox, body);
      grid.appendChild(label);
    });

    updateSelectedCompetitorSummary();
  }

  function clearSelectedCompetitor(clearInput = true) {
    state.selectedCompetitorUrl = "";
    state.selectedCompetitorName = "";
    const compInput = el("live-competitor-url");
    if (clearInput && compInput) {
      compInput.value = "";
    }
    renderIndustryCompetitors(state.activeIndustry);
  }

  function syncCompetitorSelectionFromUrl(urlStr) {
    const matched = findIndustryCompetitorByUrl(urlStr);
    if (matched) {
      state.selectedCompetitorUrl = matched.url;
      state.selectedCompetitorName = matched.name;
    } else {
      state.selectedCompetitorUrl = "";
      state.selectedCompetitorName = "";
    }
    renderIndustryCompetitors(state.activeIndustry);
  }

  function bindIndustryCompetitorPicker() {
    const tabs = el("industry-tabs");
    if (tabs) {
      tabs.addEventListener("click", (ev) => {
        const btn = ev.target.closest("[data-industry]");
        if (!btn) return;
        renderIndustryCompetitors(btn.getAttribute("data-industry"));
      });
    }

    const grid = el("industry-competitor-grid");
    if (grid) {
      grid.addEventListener("change", (ev) => {
        const cb = ev.target.closest(".competitor-card-checkbox");
        if (!cb) return;
        const compInput = el("live-competitor-url");
        if (cb.checked) {
          state.selectedCompetitorUrl = cb.value;
          state.selectedCompetitorName = cb.getAttribute("data-competitor-name") || "";
          if (compInput) compInput.value = cb.value;
        } else {
          if (normalizeUrlCompare(state.selectedCompetitorUrl) === normalizeUrlCompare(cb.value)) {
            state.selectedCompetitorUrl = "";
            state.selectedCompetitorName = "";
            if (compInput && normalizeUrlCompare(compInput.value) === normalizeUrlCompare(cb.value)) {
              compInput.value = "";
            }
          }
        }
        renderIndustryCompetitors(state.activeIndustry);
      });
    }

    const compInput = el("live-competitor-url");
    if (compInput) {
      compInput.addEventListener("input", () => {
        syncCompetitorSelectionFromUrl(compInput.value);
      });
    }

    const clearBtn = el("clear-competitor-btn");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        clearSelectedCompetitor(true);
      });
    }

    // 初始呈現預設行業清單（全部預設不勾選）
    renderIndustryCompetitors(state.activeIndustry);
  }

  function bindLiveCheck() {
    bindIndustryCompetitorPicker();

    const form = el("live-check-form");
    const input = el("live-check-url");
    const compInput = el("live-competitor-url");
    if (form && input) {
      form.addEventListener("submit", (ev) => {
        ev.preventDefault();
        const chosenCompetitor = compInput ? compInput.value.trim() : state.selectedCompetitorUrl;
        runLiveCheck(input.value, chosenCompetitor);
      });
    }

    const leadForm = el("live-lead-form");
    if (leadForm) {
      leadForm.addEventListener("submit", handleLeadSubmit);
    }

    document.querySelectorAll("[data-pk-target][data-pk-competitor]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-pk-target");
        const competitor = btn.getAttribute("data-pk-competitor");
        if (target && competitor) {
          if (compInput) compInput.value = competitor;
          syncCompetitorSelectionFromUrl(competitor);
          runLiveCheck(target, competitor);
        }
      });
    });

    document.querySelectorAll("[data-sample-url]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sampleUrl = btn.getAttribute("data-sample-url");
        if (sampleUrl) {
          clearSelectedCompetitor(true);
          runLiveCheck(sampleUrl, "");
        }
      });
    });

    const copyBtn = el("copy-live-report-btn");
    const copyFb = el("live-copy-feedback");
    if (copyBtn && copyFb) {
      copyBtn.addEventListener("click", async () => {
        const report = state.lastLiveReport;
        const compReport = state.lastCompetitorReport;
        if (!report) {
          copyFb.textContent = "請先執行一次網址初檢，再複製初檢摘要。";
          return;
        }
        const summaryLines = [
          compReport
            ? "【阿男 GEO 實戰工坊｜10 秒免費基礎初檢＋對手 PK 結果】"
            : "【阿男 GEO 實戰工坊｜10 秒免費基礎初檢結果】",
          `我方網址：${report.target_url}`,
          `我方分數：${report.score} / 100（${LIGHT_TEXT[report.grade_light] || ""}）`,
        ];
        if (compReport) {
          const diff = report.score - compReport.score;
          const diffLabel = diff > 0 ? `領先對手 +${diff} 分` : diff < 0 ? `落後對手 ${Math.abs(diff)} 分` : "與對手平手";
          summaryLines.push(`對手網址：${compReport.target_url}`);
          summaryLines.push(`對手分數：${compReport.score} / 100（${LIGHT_TEXT[compReport.grade_light] || ""}）｜PK 結果：${diffLabel}`);
        }
        summaryLines.push(
          `- robots.txt（${report.checks.robots.score}/${report.checks.robots.max_score}）：${report.checks.robots.summary}`,
          `- llms.txt（${report.checks.llms.score}/${report.checks.llms.max_score}）：${report.checks.llms.summary}`,
          `- 首頁結構（${report.checks.homepage.score}/${report.checks.homepage.max_score}）：${report.checks.homepage.summary}`,
          "我想加 LINE @250ruauk 預約完整 20 題跨引擎實測與 9 維度健檢。"
        );

        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(summaryLines.join("\n"));
          }
          copyFb.textContent = "已複製初檢摘要！請直接貼給官方 LINE @250ruauk 預約深度健檢。";
        } catch {
          copyFb.textContent = `您的基礎初檢分數為 ${report.score}/100，請加官方 LINE @250ruauk 傳送網址預約完整健檢。`;
        }
      });
    }

    syncDetailLockVisibility();
  }

  function el(id) {
    return document.getElementById(id);
  }

  function clearNode(node) {
    while (node && node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function renderRealityStrip(items) {
    const container = el("reality-strip");
    if (!container || !Array.isArray(items) || items.length === 0) return;
    clearNode(container);
    items.forEach((item) => {
      const card = document.createElement("article");
      card.className = "reality-card";

      const kicker = document.createElement("span");
      kicker.className = "reality-kicker mono";
      kicker.textContent = item.kicker;

      const title = document.createElement("h4");
      title.textContent = item.headline;

      const body = document.createElement("p");
      body.textContent = item.detail;

      card.append(kicker, title, body);
      container.appendChild(card);
    });
  }

  function renderEngine(engineId) {
    if (!state.caseData) return;
    const engine =
      state.caseData.engines.find((item) => item.id === engineId) ||
      state.caseData.engines[0];
    if (!engine) return;
    state.activeEngine = engine.id;

    const buttons = document.querySelectorAll("#engine-tablist [data-engine]");
    buttons.forEach((btn) => {
      const selected = btn.getAttribute("data-engine") === engine.id;
      btn.setAttribute("aria-selected", String(selected));
      btn.classList.toggle("is-active", selected);
    });

    const setText = (id, text) => {
      const node = el(id);
      if (node) node.textContent = text;
    };

    setText("engine-badge", engine.badge);
    setText("engine-headline", engine.headline);
    setText("engine-caption", engine.metric_caption);
    setText("engine-before-metric", engine.before_metric);
    setText("engine-after-metric", engine.after_metric);
    setText("engine-before-summary", engine.before_summary);
    setText("engine-after-summary", engine.after_summary);

    const domainsNode = el("engine-domains");
    if (domainsNode) {
      clearNode(domainsNode);
      engine.cited_domains.forEach((domain) => {
        const li = document.createElement("li");
        li.textContent = domain;
        domainsNode.appendChild(li);
      });
    }

    const samplesNode = el("engine-samples");
    if (samplesNode) {
      clearNode(samplesNode);
      engine.samples.forEach((sample) => {
        const card = document.createElement("div");
        card.className = "sample-card";

        const head = document.createElement("div");
        head.className = "sample-head";

        const qid = document.createElement("span");
        qid.className = "mono sample-qid";
        qid.textContent = sample.qid;

        const verdict = document.createElement("span");
        verdict.className = "sample-verdict";
        verdict.textContent = sample.verdict;

        head.append(qid, verdict);

        const qText = document.createElement("p");
        qText.className = "sample-q";
        qText.textContent = `「${sample.question}」`;

        const diff = document.createElement("div");
        diff.className = "sample-diff";

        const beforeRow = document.createElement("div");
        const beforeStrong = document.createElement("strong");
        beforeStrong.textContent = "改前：";
        beforeRow.append(beforeStrong, document.createTextNode(sample.before));

        const afterRow = document.createElement("div");
        const afterStrong = document.createElement("strong");
        afterStrong.textContent = "改後：";
        afterRow.append(afterStrong, document.createTextNode(sample.after));

        diff.append(beforeRow, afterRow);
        card.append(head, qText, diff);
        samplesNode.appendChild(card);
      });
    }
  }

  function renderDimension(dimId) {
    if (!state.caseData) return;
    const dim =
      state.caseData.audit_dimensions.find((item) => item.id === dimId) ||
      state.caseData.audit_dimensions[0];
    if (!dim) return;
    state.activeDim = dim.id;

    const buttons = document.querySelectorAll("#audit-dim-list [data-dim]");
    buttons.forEach((btn) => {
      const selected = btn.getAttribute("data-dim") === dim.id;
      btn.setAttribute("aria-selected", String(selected));
      btn.classList.toggle("is-active", selected);
    });

    const beforePct = Math.round((dim.before_score / dim.max_score) * 100);
    const afterPct = Math.round((dim.after_score / dim.max_score) * 100);

    const setText = (id, text) => {
      const node = el(id);
      if (node) node.textContent = text;
    };

    setText("dim-layer", dim.layer);
    setText("dim-title", dim.name);
    setText(
      "dim-score-pill",
      `改前 ${dim.before_score} → 改後 ${dim.after_score} / ${dim.max_score} 分`
    );
    setText("dim-summary", dim.summary);
    setText("dim-before-pct", `${beforePct}%`);
    setText("dim-after-pct", `${afterPct}%`);
    setText("dim-findings", dim.findings);
    setText("dim-actions", dim.actions);
    setText("dim-verification", dim.verification);

    const beforeBar = el("dim-before-bar");
    const afterBar = el("dim-after-bar");
    if (beforeBar) beforeBar.style.width = `${beforePct}%`;
    if (afterBar) afterBar.style.width = `${afterPct}%`;
  }

  function renderGuideFilter(target) {
    state.activeGuide = target;
    const buttons = document.querySelectorAll("#guide-filter [data-guide]");
    buttons.forEach((btn) => {
      const selected = btn.getAttribute("data-guide") === target;
      btn.setAttribute("aria-selected", String(selected));
      btn.classList.toggle("is-active", selected);
    });

    const articles = document.querySelectorAll("[data-guide-article]");
    articles.forEach((art) => {
      const id = art.getAttribute("data-guide-article");
      const show = target === "all" || id === target;
      art.hidden = !show;
    });
  }

  function getQuizSummary() {
    const checkboxes = [...document.querySelectorAll(".quiz-checkbox")];
    const total = checkboxes.length || 12;
    const checked = checkboxes.filter((cb) => cb.checked);
    const score = checked.length;
    const pct = Math.round((score / total) * 100);

    const layerStats = QUIZ_LAYERS.map((layer) => {
      const items = checkboxes.filter((cb) => cb.getAttribute("data-layer") === layer.id);
      const passed = items.filter((cb) => cb.checked).length;
      const missingTitles = items
        .filter((cb) => !cb.checked)
        .map((cb) => cb.getAttribute("data-short") || cb.value);
      return {
        ...layer,
        passed,
        missingTitles,
      };
    });

    let tier = "地基待補強｜AI 目前幾乎看不見你";
    let tierClass = "pill-coral";
    if (score >= 11) {
      tier = "已具實戰水準｜可轉入長期固定題庫追蹤";
      tierClass = "pill-teal";
    } else if (score >= 8) {
      tier = "基礎穩固｜下一步補第三方背書與複測";
      tierClass = "pill-teal";
    } else if (score >= 4) {
      tier = "已有骨架｜仍可能被漏抓或報錯舊價";
      tierClass = "pill-brass";
    }

    const firstWeak = layerStats.find((ls) => ls.passed < ls.total);
    let advice =
      "12 題全數達標！建議透過「20 題真人跨引擎健檢」用無痕新對話實測 AI 是否真的把你的價格與聯絡方式講對，避免只看站內設定而忽略外部舊快照。";
    if (firstWeak) {
      const weakNames = layerStats
        .filter((ls) => ls.passed < ls.total)
        .map((ls) => `${ls.name}（${ls.passed}/${ls.total}）`)
        .join("、");
      advice = `目前卡關項目：${weakNames}。依四層依賴順序，建議優先處理：${firstWeak.advice}`;
    }

    return { score, total, pct, tier, tierClass, layerStats, advice };
  }

  function updateQuizUI() {
    const checkboxes = [...document.querySelectorAll(".quiz-checkbox")];
    if (checkboxes.length === 0) return;

    checkboxes.forEach((cb) => {
      const item = cb.closest(".quiz-item");
      if (item) item.classList.toggle("is-checked", cb.checked);
    });

    const summary = getQuizSummary();
    const scoreNode = el("quiz-score-value");
    const pctNode = el("quiz-score-pct");
    const barNode = el("quiz-score-bar");
    const tierNode = el("quiz-tier-badge");
    const adviceNode = el("quiz-advice-text");

    if (scoreNode) scoreNode.textContent = `${summary.score} / ${summary.total} 題`;
    if (pctNode) pctNode.textContent = `${summary.pct}%`;
    if (barNode) barNode.style.width = `${summary.pct}%`;
    if (tierNode) {
      tierNode.textContent = summary.tier;
      tierNode.className = `pill ${summary.tierClass}`;
    }
    if (adviceNode) adviceNode.textContent = summary.advice;

    summary.layerStats.forEach((ls) => {
      const pill = el(`quiz-layer-${ls.id}`);
      if (pill) {
        pill.textContent = `${ls.name.split("｜")[1]} ${ls.passed}/${ls.total}`;
        pill.classList.toggle("is-complete", ls.passed === ls.total);
      }
    });
  }

  function bindQuizInteractions() {
    const form = el("geo-quiz-form");
    if (!form) return;

    form.addEventListener("change", () => {
      updateQuizUI();
    });

    const resetBtn = el("quiz-reset-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        document.querySelectorAll(".quiz-checkbox").forEach((cb) => {
          cb.checked = false;
        });
        updateQuizUI();
        const fb = el("quiz-copy-feedback");
        if (fb) fb.textContent = "已重設 12 題自檢表。";
      });
    }

    const copyQuizBtn = el("copy-quiz-btn");
    const quizFeedback = el("quiz-copy-feedback");
    if (copyQuizBtn && quizFeedback) {
      copyQuizBtn.addEventListener("click", async () => {
        const summary = getQuizSummary();
        const weakLines = summary.layerStats
          .filter((ls) => ls.missingTitles.length > 0)
          .map((ls) => `- ${ls.name}（${ls.passed}/${ls.total}）待補：${ls.missingTitles.join("；")}`);
        const text = [
          "【阿男 GEO 實戰工坊｜12 題自檢結果】",
          `總分：${summary.score} / ${summary.total}（${summary.pct}%）`,
          `現況判定：${summary.tier}`,
          weakLines.length > 0 ? "尚未勾選項目：\n" + weakLines.join("\n") : "12 題皆已勾選通過。",
          "我想預約 LINE @250ruauk 做 20 題跨引擎實測健檢，我的網站網址是：",
        ].join("\n");

        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
          }
          quizFeedback.textContent = "已複製自檢分數與弱點摘要！請直接貼給官方 LINE @250ruauk（記得補上您的網址）。";
        } catch {
          quizFeedback.textContent = `您的自檢分數為 ${summary.score}/${summary.total}（${summary.pct}%），請加官方 LINE @250ruauk 傳送網址預約健檢。`;
        }
      });
    }

    updateQuizUI();
  }

  function bindInteractions() {
    const engineTablist = el("engine-tablist");
    if (engineTablist) {
      engineTablist.addEventListener("click", (ev) => {
        const btn = ev.target.closest("[data-engine]");
        if (!btn) return;
        renderEngine(btn.getAttribute("data-engine"));
      });
    }

    const dimList = el("audit-dim-list");
    if (dimList) {
      dimList.addEventListener("click", (ev) => {
        const btn = ev.target.closest("[data-dim]");
        if (!btn) return;
        renderDimension(btn.getAttribute("data-dim"));
      });
    }

    const guideFilter = el("guide-filter");
    if (guideFilter) {
      guideFilter.addEventListener("click", (ev) => {
        const btn = ev.target.closest("[data-guide]");
        if (!btn) return;
        renderGuideFilter(btn.getAttribute("data-guide"));
      });
    }

    const copyBtn = el("copy-line-btn");
    const feedback = el("copy-feedback");
    if (copyBtn && feedback) {
      copyBtn.addEventListener("click", async () => {
        const lineId = "@250ruauk";
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(lineId);
          }
          feedback.textContent = `已複製官方 LINE ID：${lineId}，請直接到 LINE 貼上加入好友。`;
        } catch {
          feedback.textContent = `請手動複製官方 LINE ID：${lineId}`;
        }
      });
    }

    const navToggle = el("nav-toggle");
    const siteNav = el("site-nav");
    if (navToggle && siteNav) {
      navToggle.addEventListener("click", () => {
        const isOpen = siteNav.classList.toggle("is-open");
        navToggle.setAttribute("aria-expanded", String(isOpen));
      });
      siteNav.addEventListener("click", (ev) => {
        if (ev.target.tagName === "A" && siteNav.classList.contains("is-open")) {
          siteNav.classList.remove("is-open");
          navToggle.setAttribute("aria-expanded", "false");
        }
      });
    }

    bindLiveCheck();
    bindStarterKitGenerator();
    bindPlanPicker();
    bindLineQuestionHelper();
    bindQuizInteractions();
  }

  function sanitizeStarterText(raw, fallback) {
    const clean = String(raw || "").replace(/[\r\n]+/g, " ").trim();
    if (!clean || /\[object\s+object\]/i.test(clean) || /^(?:undefined|null|nan)$/i.test(clean)) {
      return fallback;
    }
    return clean;
  }

  function inferBrandFromReport(report) {
    const rawTitle = sanitizeStarterText(report?.checks?.homepage?.title, "");
    if (rawTitle) {
      const head = rawTitle.split(/[｜|\-–—]/)[0].trim();
      if (head && head.length <= 36) return head;
      return truncateText(rawTitle, 32);
    }
    return getHostLabel(report?.target_url || "https://yourbrand.example");
  }

  function generateStarterRobotsTxt(originUrl) {
    const origin = String(originUrl || "https://yourbrand.example").replace(/\/+$/, "");
    return [
      `# ${origin} — 基礎 GEO 爬蟲分流起手檔（由阿男 GEO 實戰工坊免費產生器建立）`,
      "# 原則：封鎖未授權基礎模型訓練爬蟲，明確放行主流搜尋與即時 AI 問答爬蟲",
      "",
      "User-agent: GPTBot",
      "User-agent: ClaudeBot",
      "User-agent: Google-Extended",
      "User-agent: Applebot-Extended",
      "User-agent: meta-externalagent",
      "User-agent: Bytespider",
      "User-agent: CCBot",
      "User-agent: Amazonbot",
      "Disallow: /",
      "",
      "User-agent: Googlebot",
      "User-agent: Bingbot",
      "User-agent: OAI-SearchBot",
      "User-agent: ChatGPT-User",
      "User-agent: Claude-SearchBot",
      "User-agent: Claude-User",
      "User-agent: PerplexityBot",
      "User-agent: Perplexity-User",
      "User-agent: DeepSeekBot",
      "User-agent: xAI-Bot",
      "Allow: /",
      "Disallow: /admin/",
      "",
      "User-agent: *",
      "Content-Signal: search=yes, ai-input=yes, ai-train=no",
      "Allow: /",
      "Disallow: /admin/",
      "",
      `Sitemap: ${origin}/sitemap.xml`,
    ].join("\n");
  }

  function generateStarterLlmsTxt({ originUrl, brandName, industryId, description, serviceNote }) {
    const origin = String(originUrl || "https://yourbrand.example").replace(/\/+$/, "");
    const tpl = STARTER_INDUSTRY_TEMPLATES[industryId] || STARTER_INDUSTRY_TEMPLATES.marketing;
    const brand = sanitizeStarterText(brandName, getHostLabel(origin));
    const desc = sanitizeStarterText(description, tpl.defaultSummary);
    const serviceLine = sanitizeStarterText(serviceNote, tpl.defaultService);

    const pageLines = [
      `- [首頁｜${brand}](${origin}/): 品牌定位、核心服務與最新公開資訊`,
      ...tpl.pages.map((p) => `- [${p.title}](${origin}${p.path}): ${p.desc}（請換成您實際 HTTP 200 公開網址）`),
    ];

    return [
      `# ${brand}`,
      `> ${desc}`,
      "",
      "## 爬蟲與引用政策",
      "- Content-Signal: search=yes, ai-input=yes, ai-train=no",
      "- 歡迎 AI 搜尋與問答引擎檢索並正確標註來源；禁止未授權用於基礎模型訓練。",
      "",
      `## 主力服務與公開價格（${tpl.label}）`,
      `- ${serviceLine}`,
      "",
      "## 服務邊界與防誤報聲明",
      `- ${tpl.boundary}`,
      "",
      "## 核心公開頁面（請維持 5～8 頁，且每頁皆為 HTTP 200）",
      ...pageLines,
      "",
      "## 官方聯絡入口",
      `- 官方網站：${origin}/`,
      "- 官方 LINE／客服窗口：（請填入您唯一公開的官方帳號或表單連結）",
    ].join("\n");
  }

  function renderStarterKitFiles() {
    const brandInput = el("starter-brand-name");
    const industrySelect = el("starter-industry");
    const serviceInput = el("starter-service-note");
    const robotsPreview = el("starter-robots-preview");
    const llmsPreview = el("starter-llms-preview");
    if (!robotsPreview || !llmsPreview) return;

    const report = state.lastLiveReport;
    const urlInputVal = String(el("live-check-url")?.value || "").trim();
    let originUrl = report?.origin || "";
    if (!originUrl && urlInputVal) {
      try {
        originUrl = new URL(/^https?:\/\//i.test(urlInputVal) ? urlInputVal : `https://${urlInputVal}`).origin;
      } catch {
        originUrl = "https://yourbrand.example";
      }
    }
    if (!originUrl) originUrl = "https://yourbrand.example";

    const industryId = industrySelect?.value || state.activeIndustry || "marketing";
    const brandName = String(brandInput?.value || "").trim() || inferBrandFromReport(report);
    const description = report?.checks?.homepage?.has_broken_description
      ? ""
      : report?.checks?.homepage?.description || "";
    const serviceNote = String(serviceInput?.value || "").trim();

    const robotsText = generateStarterRobotsTxt(originUrl);
    const llmsText = generateStarterLlmsTxt({
      originUrl,
      brandName,
      industryId,
      description,
      serviceNote,
    });

    state.starterCache.robots = robotsText;
    state.starterCache.llms = llmsText;

    const rCode = robotsPreview.querySelector("code") || robotsPreview;
    const lCode = llmsPreview.querySelector("code") || llmsPreview;
    rCode.textContent = robotsText;
    lCode.textContent = llmsText;
  }

  function triggerTextDownload(filename, text) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function bindStarterKitGenerator() {
    const genBtn = el("starter-generate-btn");
    const industrySelect = el("starter-industry");
    const brandInput = el("starter-brand-name");
    const serviceInput = el("starter-service-note");
    const fb = el("starter-kit-feedback");

    if (genBtn) {
      genBtn.addEventListener("click", () => {
        renderStarterKitFiles();
        if (fb) fb.textContent = "已依目前網址與行業產生專屬 robots.txt 與 llms.txt 基礎起手範本！可直接複製或下載。";
      });
    }
    if (industrySelect) {
      industrySelect.addEventListener("change", () => renderStarterKitFiles());
    }
    if (brandInput) {
      brandInput.addEventListener("input", () => renderStarterKitFiles());
    }
    if (serviceInput) {
      serviceInput.addEventListener("input", () => renderStarterKitFiles());
    }

    const bindCopy = (btnId, key, label) => {
      const btn = el(btnId);
      if (!btn) return;
      btn.addEventListener("click", async () => {
        if (!state.starterCache[key]) renderStarterKitFiles();
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(state.starterCache[key]);
          }
          if (fb) fb.textContent = `已複製專屬 ${label} 起手範本！放上根目錄後，歡迎找我們做深度 Schema 與 20 題實測。`;
        } catch {
          if (fb) fb.textContent = `請直接選取上方 ${label} 程式碼框複製，或點選「下載 .txt」。`;
        }
      });
    };

    const bindDownload = (btnId, key, filename) => {
      const btn = el(btnId);
      if (!btn) return;
      btn.addEventListener("click", () => {
        if (!state.starterCache[key]) renderStarterKitFiles();
        triggerTextDownload(filename, state.starterCache[key]);
        if (fb) fb.textContent = `已開始下載 ${filename}！上線前請記得把範例網址與官方聯絡帳號換成您的真實公開頁。`;
      });
    };

    bindCopy("copy-starter-robots-btn", "robots", "robots.txt");
    bindCopy("copy-starter-llms-btn", "llms", "llms.txt");
    bindDownload("download-starter-robots-btn", "robots", "robots.txt");
    bindDownload("download-starter-llms-btn", "llms", "llms.txt");

    renderStarterKitFiles();
  }

  function syncLiveReportToTools(report) {
    if (!report) return;
    const inferredBrand = inferBrandFromReport(report);

    const starterBrand = el("starter-brand-name");
    if (starterBrand && !starterBrand.value.trim()) {
      starterBrand.value = inferredBrand;
    }
    const starterInd = el("starter-industry");
    if (starterInd && state.activeIndustry) {
      starterInd.value = state.activeIndustry;
    }
    renderStarterKitFiles();

    const lineBrand = el("line-q-brand");
    const lineUrl = el("line-q-url");
    if (lineBrand && !lineBrand.value.trim()) lineBrand.value = inferredBrand;
    if (lineUrl) lineUrl.value = report.target_url || "";
    renderLineQuestionHelper(state.activeIndustry || state.activeLineIndustry);
  }

  function computeRecommendedPlan({ scale, budget, goal, applyCredit }) {
    if (scale === "enterprise" || goal === "monitor" || budget === "25k_plus") {
      if (goal === "monitor" && budget === "25k_plus") {
        return {
          planId: "ent-retainer",
          badge: "推薦方案｜企業 02",
          title: "企業月費陪跑監測（NT$25,000／月起）",
          reason: "適合需要以 8～12 週長期追蹤 AI 回答趨勢、持續審查新頁 Schema 並量化 GA4 AI 參照流量的品牌或 B2B 企業。",
          kicker: "企業長期追蹤報價",
          figure: "NT$25,000／月起",
          formula: "依每月實測題庫數與監測平台數透明報價，含書面企業 NDA 與 GA4 AI 流量追蹤設定。",
          labelForLine: "企業 02｜企業月費陪跑監測（NT$25,000／月起）",
        };
      }
      return {
        planId: "ent-audit",
        badge: "推薦方案｜企業 01",
        title: "企業深度健檢與資安承諾專案（NT$28,000）",
        reason: "適合重視法務資安 NDA、需要 50 題×多平台大樣本實測、最多 3 家對手 9 維度 PK 與高管團隊視訊講解的企業。",
        kicker: "單次企業專案總價",
        figure: "NT$28,000／專案",
        formula: "含 5 件套完整交付（50 題原答證據＋3 家對手 PK＋27 隻爬蟲 WAF 實測＋修復範本＋書面 NDA＋視訊講解）。",
        labelForLine: "企業 01｜企業深度健檢與資安承諾專案（NT$28,000）",
      };
    }

    if (goal === "rebuild" || budget === "15k_25k") {
      return {
        planId: "entry-rebuild",
        badge: "推薦方案｜入門 02",
        title: "小型官網 GEO 地基一次改造（NT$18,000）",
        reason: "直接一次補齊全站單一 @graph JSON-LD、robots.txt／llms.txt、純文字價格比較表與 3～5 個核心服務頁改寫，並附改前改後複測對照。",
        kicker: applyCredit ? "已套用 30 天內 NT$3,800 全額折抵" : "單次改造原定價（未套用折抵）",
        figure: applyCredit ? "折抵後只需補 NT$14,200" : "NT$18,000／專案",
        formula: applyCredit
          ? "原定價 NT$18,000 − 30 天內 NT$3,800 基礎健檢全額折抵 ＝ 只需再補 NT$14,200（兩階段合計仍是 NT$18,000，健檢零浪費）。"
          : "若想先花 NT$3,800 驗過 20 題原答再決定，30 天內升級仍可全額折抵 NT$3,800（只需補 NT$14,200）。",
        labelForLine: applyCredit
          ? "入門 02｜小型官網 GEO 地基一次改造（先做 NT$3,800 健檢折抵後補 NT$14,200）"
          : "入門 02｜小型官網 GEO 地基一次改造（NT$18,000）",
      };
    }

    return {
      planId: "entry-audit",
      badge: "推薦起步｜入門 01",
      title: "基礎 GEO 健檢與 20 題 AI 診斷報告（NT$3,800）",
      reason: "低門檻先用 20 題跨平台無痕實測確認 AI 有沒有點名你、有沒有報錯舊價；看過原答證據再決定自己修或升級改造。",
      kicker: applyCredit ? "30 天內升級改造折抵試算" : "單次基礎健檢定價",
      figure: applyCredit ? "升級只補 NT$14,200" : "NT$3,800／單次",
      formula: applyCredit
        ? "先付 NT$3,800 做 20 題診斷，30 天內升級 NT$18,000 小型官網改造可全額折抵，只需補差額 NT$14,200。"
        : "單次交付 20 題跨引擎原答證據＋GeoLook 6 維診斷報告；30 天內隨時可折抵升級 NT$18,000 改造。",
      labelForLine: "入門 01｜基礎 GEO 健檢與 20 題 AI 診斷報告（NT$3,800，30 天內可全額折抵）",
    };
  }

  function renderPlanPicker() {
    const widget = el("plan-picker-widget");
    if (!widget) return;

    widget.querySelectorAll(".picker-opt-btn").forEach((btn) => {
      const step = btn.getAttribute("data-step");
      const val = btn.getAttribute("data-value");
      const active = state.picker[step] === val;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });

    const rec = computeRecommendedPlan(state.picker);
    state.picker.recommendedLabel = rec.labelForLine;

    const badge = el("picker-rec-badge");
    const title = el("picker-rec-title");
    const reason = el("picker-rec-reason");
    const kicker = el("picker-calc-kicker");
    const figure = el("picker-calc-figure");
    const formula = el("picker-calc-formula");

    if (badge) badge.textContent = rec.badge;
    if (title) title.textContent = rec.title;
    if (reason) reason.textContent = rec.reason;
    if (kicker) kicker.textContent = rec.kicker;
    if (figure) figure.textContent = rec.figure;
    if (formula) formula.textContent = rec.formula;

    document.querySelectorAll(".plan-card[data-plan-id]").forEach((card) => {
      card.classList.toggle("is-picker-match", card.getAttribute("data-plan-id") === rec.planId);
    });

    renderLineQuestionHelper(state.activeLineIndustry);
  }

  function bindPlanPicker() {
    const widget = el("plan-picker-widget");
    if (!widget) return;

    widget.addEventListener("click", (ev) => {
      const btn = ev.target.closest(".picker-opt-btn");
      if (!btn) return;
      const step = btn.getAttribute("data-step");
      const val = btn.getAttribute("data-value");
      if (step && val) {
        state.picker[step] = val;
        renderPlanPicker();
      }
    });

    const creditToggle = el("picker-apply-credit");
    if (creditToggle) {
      creditToggle.addEventListener("change", () => {
        state.picker.applyCredit = Boolean(creditToggle.checked);
        renderPlanPicker();
      });
    }

    renderPlanPicker();
  }

  function buildLineBookingMessage(industryId) {
    const conf = INDUSTRY_BUYER_QUESTIONS[industryId] || INDUSTRY_BUYER_QUESTIONS.marketing;
    const brand = String(el("line-q-brand")?.value || "").trim() || "我的品牌";
    const siteUrl = String(el("line-q-url")?.value || "").trim() || state.lastLiveReport?.target_url || "（待補網址）";
    const priceNote = String(el("line-q-price")?.value || "").trim();
    const questions = conf.build(brand, priceNote);

    const lines = [
      "【預約阿男 GEO 實戰工坊健檢】",
      `行業分類：${conf.label}`,
      `品牌／官網：${brand}｜${siteUrl}`,
    ];
    if (priceNote) lines.push(`主力價格區間：${priceNote}`);
    if (state.picker?.recommendedLabel) lines.push(`感興趣方案：${state.picker.recommendedLabel}`);
    if (state.lastLiveReport) {
      lines.push(`10 秒初檢參考分數：${state.lastLiveReport.score} / 100 分`);
    }
    lines.push("想測試的 3 道買家必問 AI 題目：");
    questions.forEach((q, idx) => {
      lines.push(`${idx + 1}. ${q.text}`);
    });
    return { conf, questions, message: lines.join("\n") };
  }

  function renderLineQuestionHelper(industryId) {
    const targetId = INDUSTRY_BUYER_QUESTIONS[industryId] ? industryId : "marketing";
    state.activeLineIndustry = targetId;

    document.querySelectorAll("#line-q-tabs [data-q-industry]").forEach((btn) => {
      const active = btn.getAttribute("data-q-industry") === targetId;
      btn.setAttribute("aria-selected", String(active));
      btn.classList.toggle("is-active", active);
    });

    const { questions, message } = buildLineBookingMessage(targetId);
    const list = el("line-q-list");
    if (list) {
      clearNode(list);
      questions.forEach((q) => {
        const li = document.createElement("li");
        const tag = document.createElement("span");
        tag.className = "q-type-tag";
        tag.textContent = q.tag;
        const txt = document.createElement("span");
        txt.textContent = q.text;
        li.append(tag, txt);
        list.appendChild(li);
      });
    }

    const lineLink = el("open-line-q-link");
    if (lineLink) {
      lineLink.href = `https://line.me/R/oaMessage/@250ruauk/?${encodeURIComponent(message)}`;
    }
  }

  function bindLineQuestionHelper() {
    const tabs = el("line-q-tabs");
    if (tabs) {
      tabs.addEventListener("click", (ev) => {
        const btn = ev.target.closest("[data-q-industry]");
        if (!btn) return;
        renderLineQuestionHelper(btn.getAttribute("data-q-industry"));
      });
    }

    ["line-q-brand", "line-q-url", "line-q-price"].forEach((id) => {
      const input = el(id);
      if (input) {
        input.addEventListener("input", () => renderLineQuestionHelper(state.activeLineIndustry));
      }
    });

    const copyBtn = el("copy-line-q-btn");
    const fb = el("line-q-feedback");
    if (copyBtn && fb) {
      copyBtn.addEventListener("click", async () => {
        const { message } = buildLineBookingMessage(state.activeLineIndustry);
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(message);
          }
          fb.textContent = "已複製 3 道買家測試題與預約訊息！可直接貼給官方 LINE @250ruauk，或點右側按鈕一鍵帶字跳轉。";
        } catch {
          fb.textContent = "已準備好 3 道測試題，請點右側「一鍵帶這 3 題跳轉 LINE @250ruauk」直接送出。";
        }
      });
    }

    renderLineQuestionHelper(state.activeLineIndustry);
  }

  async function init() {
    bindInteractions();
    try {
      const resp = await fetch("./data/case-cccnan.json", { cache: "no-store" });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      state.caseData = await resp.json();
      renderRealityStrip(state.caseData.cross_engine_reality);
      renderEngine(state.activeEngine);
      renderDimension(state.activeDim);
    } catch {
      const heading = el("engine-headline");
      if (heading && !heading.textContent) {
        heading.textContent = "目前顯示靜態預設案例摘要。";
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
