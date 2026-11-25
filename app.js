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

      applyCardLight(
        card,
        home.light,
        `03｜${home.score} / ${home.max_score} 分`,
        home.summary,
        details
      );
    }

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
    bindQuizInteractions();
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
