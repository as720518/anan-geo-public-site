(() => {
  "use strict";

  const MAX_COMPARE_COUNT = 4;

  const state = {
    overview: null,
    activeTab: "overview",
    latestAudit: null,
    finderResults: [],
    finderSelectedUrls: new Set(),
    finderSearching: false,
    finderComparing: false,
  };

  const els = {
    loginView: document.getElementById("login-view"),
    appView: document.getElementById("app-view"),
    loginForm: document.getElementById("login-form"),
    loginPassword: document.getElementById("login-password"),
    togglePwBtn: document.getElementById("toggle-pw-btn"),
    loginSubmit: document.getElementById("login-submit"),
    loginError: document.getElementById("login-error"),
    loginConfigBanner: document.getElementById("login-config-banner"),
    dbStatusPill: document.getElementById("db-status-pill"),
    dbNoticeBanner: document.getElementById("db-notice-banner"),
    refreshBtn: document.getElementById("refresh-btn"),
    logoutBtn: document.getElementById("logout-btn"),
    kpiLeads: document.getElementById("kpi-leads"),
    kpiLeadsSub: document.getElementById("kpi-leads-sub"),
    kpiAudits: document.getElementById("kpi-audits"),
    kpiAuditsSub: document.getElementById("kpi-audits-sub"),
    kpiBaseline: document.getElementById("kpi-baseline"),
    kpiBaselineSub: document.getElementById("kpi-baseline-sub"),
    baselineWindow: document.getElementById("baseline-window"),
    baselineSummary: document.getElementById("baseline-summary"),
    baselineEngines: document.getElementById("baseline-engines"),
    overviewLeadsList: document.getElementById("overview-leads-list"),
    overviewAuditsList: document.getElementById("overview-audits-list"),
    leadsCountBadge: document.getElementById("leads-count-badge"),
    leadsSearch: document.getElementById("leads-search"),
    leadsList: document.getElementById("leads-list"),
    finderForm: document.getElementById("finder-form"),
    finderQuery: document.getElementById("finder-query"),
    finderSubmit: document.getElementById("finder-submit"),
    finderEngineBadge: document.getElementById("finder-engine-badge"),
    finderNotice: document.getElementById("finder-notice"),
    finderError: document.getElementById("finder-error"),
    finderResultsWrap: document.getElementById("finder-results-wrap"),
    finderCountText: document.getElementById("finder-count-text"),
    finderSelectClear: document.getElementById("finder-select-clear"),
    finderCompareBtn: document.getElementById("finder-compare-btn"),
    finderCandidatesList: document.getElementById("finder-candidates-list"),
    finderCompareWrap: document.getElementById("finder-compare-wrap"),
    finderCompareStatus: document.getElementById("finder-compare-status"),
    finderCompareResults: document.getElementById("finder-compare-results"),
    auditForm: document.getElementById("audit-form"),
    auditClientName: document.getElementById("audit-client-name"),
    auditTargetUrl: document.getElementById("audit-target-url"),
    presetCompetitors: document.getElementById("preset-competitors"),
    auditCompetitorsText: document.getElementById("audit-competitors-text"),
    auditNotes: document.getElementById("audit-notes"),
    auditError: document.getElementById("audit-error"),
    auditSubmit: document.getElementById("audit-submit"),
    auditResultBox: document.getElementById("audit-result-box"),
    auditResultTitle: document.getElementById("audit-result-title"),
    auditResultBadge: document.getElementById("audit-result-badge"),
    auditStorageMsg: document.getElementById("audit-storage-msg"),
    auditChecksDetail: document.getElementById("audit-checks-detail"),
    auditPkTable: document.getElementById("audit-pk-table"),
    downloadLatestReport: document.getElementById("download-latest-report"),
    copyLatestSummary: document.getElementById("copy-latest-summary"),
    reportsCountBadge: document.getElementById("reports-count-badge"),
    reportsList: document.getElementById("reports-list"),
    configChecklist: document.getElementById("config-checklist"),
    toast: document.getElementById("toast"),
  };

  let toastTimer = null;

  function showToast(msg) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.hidden = true;
    }, 2600);
  }

  function escapeHtml(val) {
    return String(val ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatTime(isoStr) {
    if (!isoStr) return "—";
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return String(isoStr).slice(0, 16);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function scoreClass(light, score) {
    if (light === "green" || (light == null && Number(score) >= 80)) return "score-green";
    if (light === "yellow" || (light == null && Number(score) >= 50)) return "score-yellow";
    return "score-red";
  }

  function lightColor(light) {
    if (light === "green") return "#34b399";
    if (light === "yellow") return "#d9a74a";
    return "#e26d5a";
  }

  function hostOnly(urlStr) {
    try {
      return new URL(urlStr).hostname;
    } catch {
      return String(urlStr || "");
    }
  }

  async function apiFetch(url, options = {}) {
    const resp = await fetch(url, {
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });
    let data = null;
    try {
      data = await resp.json();
    } catch {
      data = { ok: false, error: `伺服器回傳非預期格式（HTTP ${resp.status}）` };
    }
    return { status: resp.status, ok: resp.ok, data };
  }

  function switchTab(tabName) {
    state.activeTab = tabName;
    document.querySelectorAll("[data-tab-panel]").forEach((panel) => {
      panel.hidden = panel.getAttribute("data-tab-panel") !== tabName;
    });
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      const active = btn.getAttribute("data-tab") === tabName;
      btn.classList.toggle("is-active", active);
      if (active) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
  }

  function showLoginView(passwordConfigured = true) {
    els.appView.hidden = true;
    els.loginView.hidden = false;
    if (!passwordConfigured) {
      els.loginConfigBanner.textContent =
        "提示：雲端環境尚未設定 GEO_ADMIN_PASSWORD。請先至 Cloudflare Workers 後台 → Settings → Variables and Secrets 新增此 Secret 變數。";
      els.loginConfigBanner.hidden = false;
    } else {
      els.loginConfigBanner.hidden = true;
    }
  }

  function showAppView() {
    els.loginView.hidden = true;
    els.appView.hidden = false;
  }

  function renderLeadCard(lead, compact = false) {
    const myScore = lead.score != null ? `${lead.score} 分` : "未記分";
    const pkText =
      lead.competitor_url && lead.competitor_score != null
        ? `PK 對手 ${hostOnly(lead.competitor_url)}（${lead.competitor_score} 分）`
        : lead.competitor_url
          ? `對手：${hostOnly(lead.competitor_url)}`
          : "單站初檢";
    const actionsHtml = compact
      ? ""
      : `<div class="record-actions">
          <button type="button" class="ghost-mini" data-copy-email="${escapeHtml(lead.email)}">複製 Email</button>
          <button type="button" class="ghost-mini" data-audit-url="${escapeHtml(lead.target_url)}" data-audit-comp="${escapeHtml(lead.competitor_url || "")}">帶去健檢/PK</button>
        </div>`;

    return `
      <article class="record-item">
        <div class="record-top">
          <div class="record-primary">${escapeHtml(lead.email)}</div>
          <span class="score-pill ${scoreClass(lead.grade_light, lead.score)}">${escapeHtml(myScore)}</span>
        </div>
        <div class="record-url">${escapeHtml(lead.target_url)}</div>
        <div class="record-meta">
          <span>${escapeHtml(pkText)}</span>
          <span class="mono">${escapeHtml(formatTime(lead.created_at))}</span>
        </div>
        ${actionsHtml}
      </article>`;
  }

  function renderAuditCard(audit, includeDownload = false) {
    const compSummary =
      audit.competitors_count > 0
        ? `對比 ${audit.competitors_count} 個對手`
        : "單站健檢";
    const actionsHtml = includeDownload
      ? `<div class="record-actions">
          <a class="ghost-mini" href="/api/admin/audit-report?id=${encodeURIComponent(audit.id)}" target="_blank" rel="noopener">預覽簡報</a>
          <a class="ghost-mini" href="/api/admin/audit-report?id=${encodeURIComponent(audit.id)}&download=1">下載 HTML</a>
        </div>`
      : "";

    return `
      <article class="record-item">
        <div class="record-top">
          <div class="record-primary">${escapeHtml(audit.client_name || hostOnly(audit.target_url))}</div>
          <span class="score-pill ${scoreClass(audit.target_light, audit.target_score)}">${audit.target_score} / 100</span>
        </div>
        <div class="record-url">${escapeHtml(audit.target_url)}</div>
        <div class="record-meta">
          <span>${escapeHtml(compSummary)}</span>
          <span class="mono">${escapeHtml(formatTime(audit.created_at))}</span>
        </div>
        ${actionsHtml}
      </article>`;
  }

  function renderLeadsFiltered() {
    const leads = state.overview?.leads || [];
    const q = (els.leadsSearch.value || "").trim().toLowerCase();
    const filtered = q
      ? leads.filter(
          (item) =>
            String(item.email || "").toLowerCase().includes(q) ||
            String(item.target_url || "").toLowerCase().includes(q) ||
            String(item.competitor_url || "").toLowerCase().includes(q)
        )
      : leads;

    els.leadsCountBadge.textContent = `${filtered.length} 筆`;
    if (filtered.length === 0) {
      els.leadsList.innerHTML = `<div class="empty-state">${
        state.overview?.db_connected
          ? q
            ? "找不到符合條件的名單，請試試其他關鍵字。"
            : "目前尚未收到訪客 Email 解鎖名單，公開站收到新名單後會即時出現在這裡。"
          : "目前尚未綁定雲端 D1 資料庫，綁定後訪客於首頁解鎖報告的 Email 會自動同步匯入這裡。"
      }</div>`;
      return;
    }
    els.leadsList.innerHTML = filtered.map((l) => renderLeadCard(l, false)).join("");
  }

  function renderOverview(data) {
    state.overview = data;

    // 狀態燈號
    if (data.db_connected) {
      els.dbStatusPill.textContent = "D1 雲端已連線";
      els.dbStatusPill.className = "status-pill status-ok";
      els.dbNoticeBanner.hidden = true;
    } else {
      els.dbStatusPill.textContent = "未綁定 D1（降級模式）";
      els.dbStatusPill.className = "status-pill status-degraded";
      els.dbNoticeBanner.textContent =
        data.db_notice || "尚未綁定 Cloudflare D1，以下顯示 1,298 筆公開基準統計與即時健檢功能。";
      els.dbNoticeBanner.hidden = false;
    }

    // KPI 看板
    const kpi = data.kpi || {};
    const base = data.baseline || {};
    els.kpiLeads.textContent = String(kpi.leads_count ?? 0);
    els.kpiLeadsSub.textContent = data.db_connected ? "雲端 D1 即時統計" : "綁 D1 後自動累計";

    els.kpiAudits.textContent = String(kpi.audits_count ?? 0);
    els.kpiAuditsSub.textContent = data.db_connected ? "雲端儲存簡報數" : "即時健檢免綁可用";

    els.kpiBaseline.textContent = `${kpi.baseline_score_before ?? 41}→${kpi.baseline_score_after ?? 89}`;
    els.kpiBaselineSub.textContent = `${Number(kpi.baseline_samples ?? 1298).toLocaleString("en-US")} 筆實測基準`;

    // 基準卡片
    els.baselineWindow.textContent = `${base.test_days || 35} 實測日・${base.site_pages_current || 44} 頁`;
    els.baselineSummary.textContent = `品牌案例 ${base.brand_name || "阿男音樂"}（${base.domain || "www.cccnan.art"}）：自然露出 ${base.before_natural_mention || "0%"} → ${base.after_natural_mention || "50%"}；官方 LINE 命中 ${base.after_line_accuracy || "100%"}。`;

    const engines = Array.isArray(base.engines) ? base.engines : [];
    els.baselineEngines.innerHTML = engines
      .map(
        (eng) => `
        <div class="engine-tile">
          <div class="engine-name">${escapeHtml(eng.label)}</div>
          <div class="engine-metric">${escapeHtml(eng.after_metric)}</div>
          <div class="engine-badge">${escapeHtml(eng.badge)}</div>
        </div>`
      )
      .join("");

    // 總覽精簡列表
    const leads = Array.isArray(data.leads) ? data.leads : [];
    const audits = Array.isArray(data.audits) ? data.audits : [];

    els.overviewLeadsList.innerHTML =
      leads.length > 0
        ? leads.slice(0, 3).map((l) => renderLeadCard(l, true)).join("")
        : `<div class="empty-state">${data.db_connected ? "目前還沒有訪客名單。" : "綁定 D1 後會在此顯示最新 3 筆名單。"}</div>`;

    els.overviewAuditsList.innerHTML =
      audits.length > 0
        ? audits.slice(0, 3).map((a) => renderAuditCard(a, false)).join("")
        : `<div class="empty-state">尚未有雲端健檢紀錄，點下方「手機健檢/PK」馬上測一站。</div>`;

    // 名單頁
    renderLeadsFiltered();

    // 報告與設定頁
    els.reportsCountBadge.textContent = `${audits.length} 份`;
    els.reportsList.innerHTML =
      audits.length > 0
        ? audits.map((a) => renderAuditCard(a, true)).join("")
        : `<div class="empty-state">${
            data.db_connected
              ? "尚無歷史簡報，完成一次「手機健檢/PK」就會自動收錄於此。"
              : "未綁定 D1 時無法保存歷史簡報清單；請於「手機健檢/PK」完成檢測後直接下載單頁 HTML。"
          }</div>`;

    const cfg = data.config_status || {};
    const rows = [
      { label: "管理密碼（GEO_ADMIN_PASSWORD）", ok: Boolean(cfg.password_configured), okText: "已設定", noText: "未設定" },
      { label: "雲端資料庫（D1 綁定 DB）", ok: Boolean(cfg.db_bound), okText: "已連線", noText: "未綁定（降級模式）" },
      { label: "自動追單信件（RESEND_API_KEY）", ok: Boolean(cfg.resend_configured), okText: "已啟用", noText: "預覽解鎖模式" },
      { label: "關鍵字找對手（SERPER_API_KEY）", ok: Boolean(cfg.serper_configured), okText: "Google＋地圖加速", noText: "免 Key 備用搜尋" },
    ];
    els.configChecklist.innerHTML = rows
      .map(
        (r) => `
        <div class="check-row">
          <span>${escapeHtml(r.label)}</span>
          <span class="score-pill ${r.ok ? "score-green" : "score-yellow"}">${escapeHtml(r.ok ? r.okText : r.noText)}</span>
        </div>`
      )
      .join("");
  }

  async function loadOverview() {
    const res = await apiFetch("/api/admin/overview", { method: "GET" });
    if (res.status === 401) {
      showLoginView(res.data?.password_configured !== false);
      return false;
    }
    if (!res.ok || !res.data?.ok) {
      showToast(res.data?.error || "讀取總覽資料失敗");
      return false;
    }
    showAppView();
    renderOverview(res.data);
    return true;
  }

  function renderLatestAudit(data) {
    state.latestAudit = data;
    const t = data.target;
    els.auditResultTitle.textContent = `${data.client_name} 健檢結果`;
    els.auditResultBadge.textContent = `${t.score} / 100 分`;
    els.auditResultBadge.className = `score-pill ${scoreClass(t.grade_light, t.score)}`;
    els.auditStorageMsg.textContent = data.storage_notice || "";

    const checkDefs = [
      { key: "robots", title: "01｜AI 爬蟲放行（robots.txt）" },
      { key: "llms", title: "02｜AI 導覽索引（llms.txt）" },
      { key: "homepage", title: "03｜官網結構與標籤（HTML / JSON-LD）" },
    ];
    els.auditChecksDetail.innerHTML = checkDefs
      .map((def) => {
        const item = t.checks?.[def.key];
        if (!item) return "";
        const pct = Math.max(0, Math.min(100, Math.round((item.score / (item.max_score || 1)) * 100)));
        return `
          <div class="check-bar-card">
            <div class="record-top">
              <strong style="font-size:13.5px;">${escapeHtml(def.title)}</strong>
              <span class="score-pill ${scoreClass(item.light, item.score)}">${item.score}/${item.max_score}</span>
            </div>
            <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${lightColor(item.light)};"></div></div>
            <div class="record-url">${escapeHtml(item.summary || "")}</div>
          </div>`;
      })
      .join("");

    const comps = Array.isArray(data.competitors_summary) ? data.competitors_summary : [];
    if (comps.length > 0) {
      els.auditPkTable.innerHTML =
        `<div class="field-label">對手即時 PK 比較</div>` +
        comps
          .map((c) => {
            const diffText =
              c.diff > 0 ? `領先 +${c.diff} 分` : c.diff < 0 ? `落後 ${Math.abs(c.diff)} 分` : "平手";
            const cls = c.diff > 0 ? "score-green" : c.diff < 0 ? "score-red" : "score-yellow";
            return `
              <div class="check-row">
                <div style="min-width:0;">
                  <div class="record-primary" style="font-size:13.5px;">${escapeHtml(hostOnly(c.target_url))}</div>
                  <div class="record-meta">對手分數 ${c.score} / 100</div>
                </div>
                <span class="score-pill ${cls}">${escapeHtml(diffText)}</span>
              </div>`;
          })
          .join("");
    } else {
      els.auditPkTable.innerHTML = "";
    }

    els.auditResultBox.hidden = false;
  }

  function downloadHtmlFile(filename, htmlContent) {
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "geo-audit-report.html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function buildLineSummaryText(auditData) {
    const t = auditData.target;
    const lines = [
      `【GEO 基礎公開頁健檢摘要｜${auditData.client_name}】`,
      `檢測網址：${t.target_url}`,
      `基礎準備度：${t.score} / 100 分（${t.grade_label || ""}）`,
      `- AI 爬蟲放行：${t.checks?.robots?.score ?? 0} / 35`,
      `- AI 導覽索引 llms.txt：${t.checks?.llms?.score ?? 0} / 30`,
      `- 首頁結構與 JSON-LD：${t.checks?.homepage?.score ?? 0} / 35`,
    ];
    if (Array.isArray(auditData.competitors_summary) && auditData.competitors_summary.length > 0) {
      lines.push("", "【同行對手比較】");
      for (const c of auditData.competitors_summary) {
        const diffText = c.diff > 0 ? `領先 +${c.diff} 分` : c.diff < 0 ? `落後 ${Math.abs(c.diff)} 分` : "平手";
        lines.push(`- ${hostOnly(c.target_url)}：${c.score} 分（我方${diffText}）`);
      }
    }
    if (Array.isArray(t.recommendations) && t.recommendations.length > 0) {
      lines.push("", "【優先補強方向】");
      t.recommendations.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
    }
    return lines.join("\n");
  }

  // ==================== 事件綁定 ====================
  els.togglePwBtn.addEventListener("click", () => {
    const isPw = els.loginPassword.type === "password";
    els.loginPassword.type = isPw ? "text" : "password";
    els.togglePwBtn.textContent = isPw ? "隱藏" : "顯示";
  });

  els.loginForm.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    els.loginError.hidden = true;
    const password = els.loginPassword.value || "";
    if (!password) {
      els.loginError.textContent = "請先輸入管理密碼。";
      els.loginError.hidden = false;
      return;
    }

    els.loginSubmit.disabled = true;
    els.loginSubmit.textContent = "驗證中…";
    try {
      const res = await apiFetch("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      if (!res.ok || !res.data?.ok) {
        els.loginError.textContent = res.data?.error || "登入失敗，請重新確認密碼。";
        els.loginError.hidden = false;
        return;
      }
      els.loginPassword.value = "";
      await loadOverview();
      switchTab("overview");
      showToast("已進入雲端後台");
    } finally {
      els.loginSubmit.disabled = false;
      els.loginSubmit.textContent = "進入雲端後台";
    }
  });

  function sourceLabel(source) {
    if (source === "google_places") return "Google 地圖";
    if (source === "google_organic") return "Google 搜尋";
    if (source === "duckduckgo_html") return "免 Key 搜尋";
    return "公開官網";
  }

  function updateFinderSelectionUi() {
    if (!els.finderCountText || !els.finderCompareBtn) return;
    const total = state.finderResults.length;
    const selectedCount = state.finderSelectedUrls.size;
    els.finderCountText.textContent = `找到 ${total} 家同業官網（已勾選 ${selectedCount} / ${MAX_COMPARE_COUNT}）`;
    els.finderCompareBtn.disabled = state.finderComparing || selectedCount === 0;
    if (!state.finderComparing) {
      els.finderCompareBtn.textContent =
        selectedCount > 0 ? `帶入健檢／比對（${selectedCount} 家）` : "帶入健檢／比對";
    }
  }

  function renderFinderCandidates() {
    if (!els.finderCandidatesList || !els.finderResultsWrap) return;
    const list = state.finderResults;
    if (list.length === 0) {
      els.finderResultsWrap.hidden = false;
      els.finderCandidatesList.innerHTML =
        '<div class="empty-state">目前沒有找到符合條件的獨立同業官網，請嘗試不同地區＋行業關鍵字，或於下方手動輸入網址。</div>';
      updateFinderSelectionUi();
      return;
    }

    els.finderResultsWrap.hidden = false;
    els.finderCandidatesList.innerHTML = list
      .map((item, idx) => {
        const checked = state.finderSelectedUrls.has(item.url);
        return `
          <label class="candidate-card${checked ? " is-selected" : ""}" data-candidate-url="${escapeHtml(item.url)}">
            <input
              type="checkbox"
              class="candidate-check"
              data-candidate-idx="${idx}"
              value="${escapeHtml(item.url)}"
              ${checked ? "checked" : ""}
            >
            <div class="candidate-body">
              <div class="candidate-top">
                <span class="candidate-title">${escapeHtml(item.title || item.domain)}</span>
                <span class="candidate-source">${escapeHtml(sourceLabel(item.source))}</span>
              </div>
              <div class="candidate-domain mono">${escapeHtml(item.domain)}</div>
              <div class="candidate-url">${escapeHtml(item.url)}</div>
              ${item.snippet ? `<div class="candidate-snippet">${escapeHtml(item.snippet)}</div>` : ""}
            </div>
          </label>`;
      })
      .join("");
    updateFinderSelectionUi();
  }

  function renderCompareCardHtml(entry) {
    const title = entry.title || entry.domain || hostOnly(entry.url);
    const domain = entry.domain || hostOnly(entry.url);

    if (entry.status === "pending" || entry.status === "loading") {
      const label = entry.status === "loading" ? "即時健檢中…" : "排隊等候中";
      return `
        <article class="compare-card is-loading">
          <div class="compare-card-head">
            <strong class="compare-title">${escapeHtml(title)}</strong>
            <span class="compare-domain mono">${escapeHtml(domain)}</span>
          </div>
          <div class="compare-loading-text">${escapeHtml(label)}</div>
        </article>`;
    }

    if (entry.status === "error" || !entry.report) {
      return `
        <article class="compare-card is-error">
          <div class="compare-card-head">
            <strong class="compare-title">${escapeHtml(title)}</strong>
            <span class="compare-domain mono">${escapeHtml(domain)}</span>
          </div>
          <div class="compare-score-row">
            <span class="score-pill score-red">無法讀取</span>
          </div>
          <p class="compare-summary">${escapeHtml(entry.error || "網站連線逾時或暫時阻擋抓取。")}</p>
          <div class="compare-actions">
            <button type="button" class="ghost-mini" data-set-primary-url="${escapeHtml(entry.url)}" data-set-primary-name="${escapeHtml(title)}">設為主測站</button>
          </div>
        </article>`;
    }

    const r = entry.report;
    const robotsScore = r.checks?.robots?.score ?? 0;
    const llmsScore = r.checks?.llms?.score ?? 0;
    const homeScore = r.checks?.homepage?.score ?? 0;
    const lightText = r.grade_light === "green" ? "綠燈" : r.grade_light === "yellow" ? "黃燈" : "紅燈";

    return `
      <article class="compare-card">
        <div class="compare-card-head">
          <strong class="compare-title">${escapeHtml(title)}</strong>
          <span class="compare-domain mono">${escapeHtml(domain)}</span>
        </div>
        <div class="compare-score-row">
          <strong class="compare-score mono">${r.score}<span>/100</span></strong>
          <span class="score-pill ${scoreClass(r.grade_light, r.score)}">${escapeHtml(lightText)}</span>
        </div>
        <div class="compare-pillars">
          <div class="compare-pillar"><span>爬蟲</span><strong class="mono">${robotsScore}/35</strong></div>
          <div class="compare-pillar"><span>llms</span><strong class="mono">${llmsScore}/30</strong></div>
          <div class="compare-pillar"><span>結構</span><strong class="mono">${homeScore}/35</strong></div>
        </div>
        <p class="compare-summary">${escapeHtml(r.grade_label || "")}</p>
        <div class="compare-actions">
          <button type="button" class="ghost-mini" data-set-primary-url="${escapeHtml(entry.url)}" data-set-primary-name="${escapeHtml(title)}">設為主測站</button>
        </div>
      </article>`;
  }

  function renderCompareCards(entries) {
    if (!els.finderCompareResults || !els.finderCompareWrap) return;
    els.finderCompareWrap.hidden = false;
    els.finderCompareResults.innerHTML = entries.map(renderCompareCardHtml).join("");
  }

  function resetFinderState() {
    state.finderResults = [];
    state.finderSelectedUrls = new Set();
    state.finderSearching = false;
    state.finderComparing = false;
    if (els.finderNotice) els.finderNotice.hidden = true;
    if (els.finderError) els.finderError.hidden = true;
    if (els.finderResultsWrap) els.finderResultsWrap.hidden = true;
    if (els.finderCompareWrap) els.finderCompareWrap.hidden = true;
    if (els.finderCandidatesList) els.finderCandidatesList.innerHTML = "";
    if (els.finderCompareResults) els.finderCompareResults.innerHTML = "";
  }

  els.logoutBtn.addEventListener("click", async () => {
    await apiFetch("/api/admin/logout", { method: "POST", body: "{}" });
    state.overview = null;
    state.latestAudit = null;
    resetFinderState();
    els.auditResultBox.hidden = true;
    showLoginView(true);
    showToast("已安全登出");
  });

  els.refreshBtn.addEventListener("click", async () => {
    showToast("更新資料中…");
    const ok = await loadOverview();
    if (ok) showToast("已更新最新雲端資料");
  });

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab(btn.getAttribute("data-tab") || "overview");
    });
  });

  document.querySelectorAll("[data-jump-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab(btn.getAttribute("data-jump-tab") || "overview");
    });
  });

  els.leadsSearch.addEventListener("input", renderLeadsFiltered);

  els.leadsList.addEventListener("click", async (evt) => {
    const copyBtn = evt.target.closest("[data-copy-email]");
    if (copyBtn) {
      const email = copyBtn.getAttribute("data-copy-email") || "";
      try {
        await navigator.clipboard.writeText(email);
        showToast(`已複製 ${email}`);
      } catch {
        showToast("無法自動複製，請長按 Email 複製");
      }
      return;
    }

    const auditBtn = evt.target.closest("[data-audit-url]");
    if (auditBtn) {
      els.auditTargetUrl.value = auditBtn.getAttribute("data-audit-url") || "";
      const comp = auditBtn.getAttribute("data-audit-comp") || "";
      els.auditCompetitorsText.value = comp;
      switchTab("audit");
      showToast("已帶入網址，按下開始即可健檢");
    }
  });

  els.auditForm.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    els.auditError.hidden = true;

    const targetUrl = (els.auditTargetUrl.value || "").trim();
    if (!targetUrl) {
      els.auditError.textContent = "請輸入要檢測的客戶公開網址。";
      els.auditError.hidden = false;
      return;
    }

    const checkedPresets = Array.from(
      els.presetCompetitors.querySelectorAll('input[type="checkbox"]:checked')
    ).map((i) => i.value);
    const customLines = (els.auditCompetitorsText.value || "")
      .split(/[\r\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const competitorUrls = [...checkedPresets, ...customLines].slice(0, 3);

    els.auditSubmit.disabled = true;
    els.auditSubmit.textContent = "雲端檢測與產生簡報中…";
    try {
      const res = await apiFetch("/api/admin/audit", {
        method: "POST",
        body: JSON.stringify({
          client_name: (els.auditClientName.value || "").trim(),
          target_url: targetUrl,
          competitor_urls: competitorUrls,
          notes: (els.auditNotes.value || "").trim(),
        }),
      });
      if (res.status === 401) {
        showLoginView(true);
        showToast("登入階段已逾時，請重新登入");
        return;
      }
      if (!res.ok || !res.data?.ok) {
        els.auditError.textContent = res.data?.error || "健檢失敗，請確認網址可公開讀取。";
        els.auditError.hidden = false;
        return;
      }
      renderLatestAudit(res.data);
      showToast("健檢完成，簡報已可下載");
      await loadOverview();
    } finally {
      els.auditSubmit.disabled = false;
      els.auditSubmit.textContent = "開始雲端健檢並產出簡報";
    }
  });

  els.downloadLatestReport.addEventListener("click", () => {
    if (!state.latestAudit?.report_html) {
      showToast("目前沒有可下載的簡報");
      return;
    }
    downloadHtmlFile(state.latestAudit.report_filename, state.latestAudit.report_html);
    showToast("已開始下載單頁 HTML 簡報");
  });

  els.copyLatestSummary.addEventListener("click", async () => {
    if (!state.latestAudit) return;
    const text = buildLineSummaryText(state.latestAudit);
    try {
      await navigator.clipboard.writeText(text);
      showToast("已複製重點摘要，可直接貼進 LINE");
    } catch {
      showToast("複製失敗，請改下載單頁 HTML 簡報");
    }
  });

  if (els.finderForm) {
    els.finderForm.addEventListener("submit", async (evt) => {
      evt.preventDefault();
      if (state.finderSearching) return;
      els.finderError.hidden = true;
      els.finderNotice.hidden = true;

      const query = (els.finderQuery.value || "").trim();
      if (!query) {
        els.finderError.textContent = "請先輸入要搜尋的關鍵字（例如：高雄 牙醫）。";
        els.finderError.hidden = false;
        return;
      }

      const excludeDomain = (els.auditTargetUrl.value || "").trim();
      state.finderSearching = true;
      els.finderSubmit.disabled = true;
      els.finderSubmit.textContent = "搜尋中…";

      try {
        const res = await apiFetch("/api/admin/search-competitors", {
          method: "POST",
          body: JSON.stringify({
            query,
            exclude_domain: excludeDomain || undefined,
            limit: 8,
          }),
        });
        if (res.status === 401) {
          showLoginView(true);
          showToast("登入階段已逾時，請重新登入");
          return;
        }
        if (!res.ok || !res.data?.ok) {
          els.finderError.textContent = res.data?.error || "搜尋失敗，請稍後再試。";
          els.finderError.hidden = false;
          return;
        }

        const data = res.data;
        const results = Array.isArray(data.results) ? data.results : [];
        state.finderResults = results;
        state.finderSelectedUrls = new Set(results.slice(0, MAX_COMPARE_COUNT).map((r) => r.url));

        if (els.finderEngineBadge) {
          els.finderEngineBadge.textContent =
            data.engine === "serper" ? "Serper Google＋地圖" : "免 Key 備用搜尋";
          els.finderEngineBadge.className = data.engine === "serper" ? "tag-brass" : "tag-mono";
        }

        const bannerMessages = [data.notice, data.warning].filter(Boolean);
        if (bannerMessages.length > 0) {
          els.finderNotice.textContent = bannerMessages.join(" ");
          els.finderNotice.hidden = false;
        }

        renderFinderCandidates();
        showToast(
          results.length > 0
            ? `找到 ${results.length} 家同業官網，已預選前 ${Math.min(results.length, MAX_COMPARE_COUNT)} 家`
            : "查無符合條件的獨立同業官網"
        );
      } finally {
        state.finderSearching = false;
        els.finderSubmit.disabled = false;
        els.finderSubmit.textContent = "搜尋對手";
      }
    });
  }

  if (els.finderCandidatesList) {
    els.finderCandidatesList.addEventListener("change", (evt) => {
      const input = evt.target.closest('input.candidate-check[type="checkbox"]');
      if (!input) return;
      const url = input.value;
      const card = input.closest(".candidate-card");
      if (input.checked) {
        if (state.finderSelectedUrls.size >= MAX_COMPARE_COUNT) {
          input.checked = false;
          showToast(`最多同時勾選 ${MAX_COMPARE_COUNT} 家進行並排比對`);
          return;
        }
        state.finderSelectedUrls.add(url);
        if (card) card.classList.add("is-selected");
      } else {
        state.finderSelectedUrls.delete(url);
        if (card) card.classList.remove("is-selected");
      }
      updateFinderSelectionUi();
    });
  }

  if (els.finderSelectClear) {
    els.finderSelectClear.addEventListener("click", () => {
      state.finderSelectedUrls.clear();
      els.finderCandidatesList.querySelectorAll("input.candidate-check").forEach((cb) => {
        cb.checked = false;
      });
      els.finderCandidatesList.querySelectorAll(".candidate-card").forEach((card) => {
        card.classList.remove("is-selected");
      });
      updateFinderSelectionUi();
    });
  }

  if (els.finderCompareBtn) {
    els.finderCompareBtn.addEventListener("click", async () => {
      if (state.finderComparing) return;
      const selected = state.finderResults
        .filter((item) => state.finderSelectedUrls.has(item.url))
        .slice(0, MAX_COMPARE_COUNT);

      if (selected.length === 0) {
        showToast("請先勾選至少 1 家同業官網");
        return;
      }

      // 同步帶入下方「手機健檢/PK」對手欄位（最多 3 家供完整簡報使用）
      if (els.auditCompetitorsText) {
        els.auditCompetitorsText.value = selected
          .slice(0, 3)
          .map((item) => item.url)
          .join("\n");
      }

      state.finderComparing = true;
      els.finderCompareBtn.disabled = true;
      els.finderCompareBtn.textContent = "逐一健檢比對中…";

      const entries = selected.map((item) => ({
        title: item.title,
        domain: item.domain,
        url: item.url,
        status: "pending",
        report: null,
        error: null,
      }));
      renderCompareCards(entries);

      try {
        for (let i = 0; i < entries.length; i += 1) {
          entries[i].status = "loading";
          if (els.finderCompareStatus) {
            els.finderCompareStatus.textContent = `檢測中 ${i + 1} / ${entries.length}`;
          }
          renderCompareCards(entries);

          try {
            const res = await apiFetch(`/api/check?url=${encodeURIComponent(entries[i].url)}`, {
              method: "GET",
            });
            if (res.ok && res.data?.ok) {
              entries[i].status = "done";
              entries[i].report = res.data;
            } else {
              entries[i].status = "error";
              entries[i].error = res.data?.error || `HTTP ${res.status} 無法完成初檢`;
            }
          } catch {
            entries[i].status = "error";
            entries[i].error = "連線逾時或暫時無法讀取該網站。";
          }
          renderCompareCards(entries);
        }

        if (els.finderCompareStatus) {
          els.finderCompareStatus.textContent = `已完成 ${entries.length} 家比對`;
        }
        showToast(`已完成 ${entries.length} 家同業即時健檢比對，並同步帶入對手欄位`);
      } finally {
        state.finderComparing = false;
        updateFinderSelectionUi();
      }
    });
  }

  if (els.finderCompareResults) {
    els.finderCompareResults.addEventListener("click", (evt) => {
      const btn = evt.target.closest("[data-set-primary-url]");
      if (!btn) return;
      const targetUrl = btn.getAttribute("data-set-primary-url") || "";
      const targetName = btn.getAttribute("data-set-primary-name") || "";
      if (els.auditTargetUrl) els.auditTargetUrl.value = targetUrl;
      if (els.auditClientName && targetName) els.auditClientName.value = targetName.slice(0, 80);
      showToast("已設為客戶主測站，往下按即可產出完整簡報");
      els.auditForm?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // 啟動檢查：呼叫 /api/admin/session（固定 HTTP 200，確保未登入時 0 console error）
  async function bootstrap() {
    const res = await apiFetch("/api/admin/session", { method: "GET" });
    if (res.ok && res.data?.authenticated) {
      await loadOverview();
    } else {
      showLoginView(res.data?.password_configured !== false);
    }
  }

  bootstrap();
})();
