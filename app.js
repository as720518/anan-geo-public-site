/* 阿男 GEO 實戰工坊 — 唯讀案例儀表板、12 題自檢表與互動控制器（零外部依賴） */
(() => {
  "use strict";

  const QUIZ_LAYERS = [
    { id: "access", name: "第 1 關｜訪問層", total: 3, advice: "先修第 1 關（靜態 HTML、robots.txt 放行搜尋爬蟲與舊測試域 308 轉址），否則 AI 連門都進不來。" },
    { id: "orientation", name: "第 2 關｜定向層", total: 3, advice: "先補第 2 關（乾淨 sitemap、唯一 canonical 與精簡有效 llms.txt），避免 AI 抓錯分身頁面。" },
    { id: "understanding", name: "第 3 關｜理解層", total: 3, advice: "補強第 3 關（全平台口徑一致＋單一 @graph JSON-LD 與可見文字一致），降低認錯品牌或報錯價機率。" },
    { id: "quotability", name: "第 4 關｜可引用層", total: 3, advice: "強化第 4 關（純文字價格對比表、首段直答邊界與獨立第三方回饋），讓 AI 敢把你寫進推薦名單。" },
  ];

  const state = {
    caseData: null,
    activeEngine: "overview",
    activeDim: "crawlability",
    activeGuide: "all",
    liveChecking: false,
    lastLiveReport: null,
  };

  const RING_CIRCUMFERENCE = 2 * Math.PI * 50; // r=50 -> 314.159...

  const LIGHT_TEXT = {
    green: "綠燈",
    yellow: "黃燈",
    red: "紅燈",
    idle: "待檢測",
  };

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

  function renderLiveCheckResult(report) {
    state.lastLiveReport = report;

    const score = Number.isFinite(report.score) ? Math.max(0, Math.min(100, report.score)) : 0;
    const gradeLight = report.grade_light || "red";

    const scoreNode = el("live-score-value");
    if (scoreNode) scoreNode.textContent = String(score);

    const ringFill = el("live-score-ring-fill");
    if (ringFill) {
      const offset = RING_CIRCUMFERENCE * (1 - score / 100);
      ringFill.setAttribute("stroke-dasharray", RING_CIRCUMFERENCE.toFixed(2));
      ringFill.setAttribute("stroke-dashoffset", offset.toFixed(2));
      ringFill.setAttribute("class", `score-ring-fill is-${gradeLight}`);
    }

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
      targetDisplay.textContent = `${report.target_url}（耗時 ${sec} 秒）`;
    }

    const headline = el("live-grade-headline");
    if (headline) headline.textContent = report.grade_label || "已完成公開頁基礎初檢";

    const metaNote = el("live-meta-note");
    if (metaNote) {
      const robots = report.checks?.robots;
      const llms = report.checks?.llms;
      const home = report.checks?.homepage;
      metaNote.textContent = `分項得分：robots.txt ${robots?.score ?? 0}/${robots?.max_score ?? 35}、llms.txt ${llms?.score ?? 0}/${llms?.max_score ?? 30}、首頁結構 ${home?.score ?? 0}/${home?.max_score ?? 35}。`;
    }

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
  }

  async function runLiveCheck(rawUrl) {
    if (state.liveChecking) return;
    const input = el("live-check-url");
    const submitBtn = el("live-check-submit");
    const target = String(rawUrl ?? input?.value ?? "").trim();

    if (!target) {
      setLiveStatus("請先輸入欲檢測的公開網站網址（例如 https://anangeo.com）。", "error");
      if (input) input.focus();
      return;
    }

    if (input) input.value = target;
    state.liveChecking = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "檢測中...";
    }
    setLiveStatus(`正在即時檢測 ${target} 的 robots.txt、llms.txt 與首頁結構，請稍候...`, "loading");

    try {
      const resp = await fetch(`/api/check?url=${encodeURIComponent(target)}`, {
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
        setLiveStatus(msg, "error");
        return;
      }

      renderLiveCheckResult(payload);
      setLiveStatus(
        `已完成 ${payload.target_url} 基礎 GEO 初檢：${payload.score} / 100 分（${LIGHT_TEXT[payload.grade_light] || ""}）。`,
        "success"
      );
    } catch {
      setLiveStatus(
        "連線至 /api/check 失敗，請確認網路連線正常；若需人工協助，歡迎加官方 LINE @250ruauk。",
        "error"
      );
    } finally {
      state.liveChecking = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "開始初檢";
      }
    }
  }

  function bindLiveCheck() {
    const form = el("live-check-form");
    const input = el("live-check-url");
    if (form && input) {
      form.addEventListener("submit", (ev) => {
        ev.preventDefault();
        runLiveCheck(input.value);
      });
    }

    document.querySelectorAll("[data-sample-url]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sampleUrl = btn.getAttribute("data-sample-url");
        if (sampleUrl) {
          runLiveCheck(sampleUrl);
        }
      });
    });

    const copyBtn = el("copy-live-report-btn");
    const copyFb = el("live-copy-feedback");
    if (copyBtn && copyFb) {
      copyBtn.addEventListener("click", async () => {
        const report = state.lastLiveReport;
        if (!report) {
          copyFb.textContent = "請先執行一次網址初檢，再複製初檢摘要。";
          return;
        }
        const summaryLines = [
          "【阿男 GEO 實戰工坊｜10 秒免費基礎初檢結果】",
          `檢測網址：${report.target_url}`,
          `基礎分數：${report.score} / 100（${LIGHT_TEXT[report.grade_light] || ""}）`,
          `- robots.txt（${report.checks.robots.score}/${report.checks.robots.max_score}）：${report.checks.robots.summary}`,
          `- llms.txt（${report.checks.llms.score}/${report.checks.llms.max_score}）：${report.checks.llms.summary}`,
          `- 首頁結構（${report.checks.homepage.score}/${report.checks.homepage.max_score}）：${report.checks.homepage.summary}`,
          "我想加 LINE @250ruauk 預約完整 20 題跨引擎實測與 9 維度健檢。",
        ].join("\n");

        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(summaryLines);
          }
          copyFb.textContent = "已複製初檢摘要！請直接貼給官方 LINE @250ruauk 預約深度健檢。";
        } catch {
          copyFb.textContent = `您的基礎初檢分數為 ${report.score}/100，請加官方 LINE @250ruauk 傳送網址預約完整健檢。`;
        }
      });
    }
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
