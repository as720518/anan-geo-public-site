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
  };

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
