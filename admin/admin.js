(() => {
  "use strict";

  const MAX_COMPARE_COUNT = 4;

  const state = {
    role: null,
    partnerName: "",
    partnerEnabled: false,
    loginMode: "admin",
    partnerRateLimit: null,
    overview: null,
    overviewSummary: null,
    vipClientName: "",
    activeTab: "overview",
    activeWorkTab: "audit-tools",
    latestAudit: null,
    finderResults: [],
    finderSelectedUrls: new Set(),
    finderCompareEntries: [],
    finderSearching: false,
    finderComparing: false,
    calc: {
      planId: "turnkey_25000",
      adjustmentId: "none",
      tierId: "intro_25",
      customDirectCost: null,
      clientName: "",
    },
    posts: [],
    postsLoaded: false,
    postsLoading: false,
    postsSubmitting: false,
    postsConfirmDeleteId: null,
    postsDeletingId: null,
  };

  const els = {
    loginView: document.getElementById("login-view"),
    appView: document.getElementById("app-view"),
    loginDesc: document.getElementById("login-desc"),
    loginModeTabs: document.getElementById("login-mode-tabs"),
    loginPartnerHint: document.getElementById("login-partner-hint"),
    loginPartnerNameField: document.getElementById("login-partner-name-field"),
    loginPartnerName: document.getElementById("login-partner-name"),
    loginPasswordLabel: document.getElementById("login-password-label"),
    loginForm: document.getElementById("login-form"),
    loginPassword: document.getElementById("login-password"),
    togglePwBtn: document.getElementById("toggle-pw-btn"),
    loginSubmit: document.getElementById("login-submit"),
    loginError: document.getElementById("login-error"),
    loginConfigBanner: document.getElementById("login-config-banner"),
    topbarName: document.getElementById("topbar-name"),
    dbStatusPill: document.getElementById("db-status-pill"),
    dbNoticeBanner: document.getElementById("db-notice-banner"),
    kpiGrid: document.getElementById("kpi-grid"),
    bottomNav: document.getElementById("bottom-nav"),
    partnerWorkspaceBanner: document.getElementById("partner-workspace-banner"),
    partnerQuotaPill: document.getElementById("partner-quota-pill"),
    partnerSignatureInput: document.getElementById("partner-signature-input"),
    auditFormTitle: document.getElementById("audit-form-title"),
    auditFormBadge: document.getElementById("audit-form-badge"),
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
    cloudSummaryCard: document.getElementById("cloud-summary-card"),
    summaryStatusBadge: document.getElementById("summary-status-badge"),
    summaryHeadline: document.getElementById("summary-headline"),
    summaryLeadsVal: document.getElementById("summary-leads-val"),
    summaryLeadsSub: document.getElementById("summary-leads-sub"),
    summaryAuditsVal: document.getElementById("summary-audits-val"),
    summaryAuditsSub: document.getElementById("summary-audits-sub"),
    summarySamplesVal: document.getElementById("summary-samples-val"),
    summarySamplesSub: document.getElementById("summary-samples-sub"),
    summaryLightsVal: document.getElementById("summary-lights-val"),
    summaryLightsSub: document.getElementById("summary-lights-sub"),
    summaryUpdatedMeta: document.getElementById("summary-updated-meta"),
    vipDeliveryCard: document.getElementById("vip-delivery-card"),
    vipClientName: document.getElementById("vip-client-name"),
    vipPreviewBtn: document.getElementById("vip-preview-btn"),
    vipCopyLinkBtn: document.getElementById("vip-copy-link-btn"),
    vipGreetingPreview: document.getElementById("vip-greeting-preview"),
    vipCopyFeedback: document.getElementById("vip-copy-feedback"),
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
    finderCompareActions: document.getElementById("finder-compare-actions"),
    previewFinderPkReport: document.getElementById("preview-finder-pk-report"),
    downloadFinderPkReport: document.getElementById("download-finder-pk-report"),
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
    previewLatestReport: document.getElementById("preview-latest-report"),
    downloadLatestReport: document.getElementById("download-latest-report"),
    copyLatestSummary: document.getElementById("copy-latest-summary"),
    workspaceSubtabs: document.getElementById("workspace-subtabs"),
    auditToolsPanel: document.getElementById("audit-tools-panel"),
    pricingCalcPanel: document.getElementById("pricing-calc-panel"),
    calcPlanList: document.getElementById("calc-plan-list"),
    calcAdjustmentList: document.getElementById("calc-adjustment-list"),
    calcAdjustmentNote: document.getElementById("calc-adjustment-note"),
    calcTierList: document.getElementById("calc-tier-list"),
    calcDirectCost: document.getElementById("calc-direct-cost"),
    calcCostReset: document.getElementById("calc-cost-reset"),
    calcCostHint: document.getElementById("calc-cost-hint"),
    calcOutClient: document.getElementById("calc-out-client"),
    calcOutClientSub: document.getElementById("calc-out-client-sub"),
    calcOutPartner: document.getElementById("calc-out-partner"),
    calcOutPartnerSub: document.getElementById("calc-out-partner-sub"),
    calcOutAnan: document.getElementById("calc-out-anan"),
    calcOutAnanSub: document.getElementById("calc-out-anan-sub"),
    calcBreakdownBar: document.getElementById("calc-breakdown-bar"),
    calcClientName: document.getElementById("calc-client-name"),
    calcQuotePreview: document.getElementById("calc-quote-preview"),
    calcCopyQuote: document.getElementById("calc-copy-quote"),
    reportPreviewModal: document.getElementById("report-preview-modal"),
    reportPreviewTitle: document.getElementById("report-preview-title"),
    reportPreviewIframe: document.getElementById("report-preview-iframe"),
    reportPreviewDownload: document.getElementById("report-preview-download"),
    reportPreviewClose: document.getElementById("report-preview-close"),
    reportsCountBadge: document.getElementById("reports-count-badge"),
    reportsList: document.getElementById("reports-list"),
    configChecklist: document.getElementById("config-checklist"),
    postCreateForm: document.getElementById("post-create-form"),
    postTitle: document.getElementById("post-title"),
    postSummary: document.getElementById("post-summary"),
    postPrice: document.getElementById("post-price"),
    postImageUrl: document.getElementById("post-image-url"),
    postPublishThreads: document.getElementById("post-publish-threads"),
    postFormError: document.getElementById("post-form-error"),
    postFormStatus: document.getElementById("post-form-status"),
    postSubmitBtn: document.getElementById("post-submit-btn"),
    postLivePreview: document.getElementById("post-live-preview"),
    postsCountBadge: document.getElementById("posts-count-badge"),
    postsRefreshBtn: document.getElementById("posts-refresh-btn"),
    postsListNotice: document.getElementById("posts-list-notice"),
    postsList: document.getElementById("posts-list"),
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

  function getEffectivePartnerName() {
    if (state.role !== "partner") return "";
    const typed = (els.partnerSignatureInput?.value || "").replace(/\s+/g, " ").trim().slice(0, 40);
    return typed || state.partnerName || "特約合夥人";
  }

  function renderPartnerQuota(rateLimit) {
    if (rateLimit && typeof rateLimit === "object") {
      state.partnerRateLimit = rateLimit;
    }
    const rl = state.partnerRateLimit;
    if (!els.partnerQuotaPill) return;
    if (!rl) {
      els.partnerQuotaPill.textContent = "每小時上限 30 次";
      return;
    }
    els.partnerQuotaPill.textContent = `搜尋剩餘 ${rl.hourly_remaining}/${rl.hourly_limit}（時）・${rl.daily_remaining}/${rl.daily_limit}（日）`;
  }

  function setLoginMode(mode) {
    const next = mode === "partner" ? "partner" : "admin";
    state.loginMode = next;
    const isPartner = next === "partner";
    if (els.loginModeTabs) {
      els.loginModeTabs.querySelectorAll("[data-login-mode]").forEach((btn) => {
        const active = btn.getAttribute("data-login-mode") === next;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-selected", active ? "true" : "false");
      });
    }
    if (els.loginPartnerNameField) els.loginPartnerNameField.hidden = !isPartner;
    if (els.loginPartnerHint) els.loginPartnerHint.hidden = !isPartner;
    if (els.loginPasswordLabel) {
      els.loginPasswordLabel.textContent = isPartner ? "合夥人專用口令" : "管理密碼";
    }
    if (els.loginPassword) {
      els.loginPassword.placeholder = isPartner ? "請輸入合夥人專用口令" : "請輸入管理密碼";
    }
    if (els.loginSubmit && !els.loginSubmit.disabled) {
      els.loginSubmit.textContent = isPartner ? "進入合夥人工作台" : "進入雲端後台";
    }
    if (els.loginError) els.loginError.hidden = true;
  }

  function clearAdminOnlyDom() {
    state.overviewSummary = null;
    if (els.overviewLeadsList) els.overviewLeadsList.innerHTML = "";
    if (els.overviewAuditsList) els.overviewAuditsList.innerHTML = "";
    if (els.leadsList) els.leadsList.innerHTML = "";
    if (els.reportsList) els.reportsList.innerHTML = "";
    if (els.configChecklist) els.configChecklist.innerHTML = "";
    if (els.postsList) els.postsList.innerHTML = "";
    if (els.postsListNotice) els.postsListNotice.hidden = true;
    state.posts = [];
    state.postsLoaded = false;
    state.postsConfirmDeleteId = null;
    state.postsDeletingId = null;
  }

  function applyRoleView(role, partnerName = "", rateLimit = null) {
    const isPartner = role === "partner";
    state.role = isPartner ? "partner" : "admin";
    state.partnerName = isPartner ? String(partnerName || "").trim().slice(0, 40) : "";
    document.body.classList.toggle("role-partner", isPartner);

    if (isPartner) {
      state.overview = null;
      clearAdminOnlyDom();
      if (els.kpiGrid) els.kpiGrid.hidden = true;
      if (els.dbNoticeBanner) els.dbNoticeBanner.hidden = true;
      if (els.bottomNav) els.bottomNav.hidden = true;
      if (els.partnerWorkspaceBanner) els.partnerWorkspaceBanner.hidden = false;
      if (els.topbarName) els.topbarName.textContent = "合夥人工作台";
      if (els.dbStatusPill) {
        els.dbStatusPill.textContent = state.partnerName ? `合夥人・${state.partnerName}` : "合夥人免費入口";
        els.dbStatusPill.className = "status-pill status-ok";
      }
      if (els.partnerSignatureInput) {
        els.partnerSignatureInput.value = state.partnerName;
      }
      renderPartnerQuota(rateLimit);
      if (els.auditFormTitle) els.auditFormTitle.textContent = "10 秒即時健檢與對手 PK";
      if (els.auditFormBadge) els.auditFormBadge.textContent = "合夥人免費直跑";
      if (els.auditSubmit && !els.auditSubmit.disabled) {
        els.auditSubmit.textContent = "開始 10 秒健檢並產出簡報";
      }
      switchTab("audit");
    } else {
      if (els.kpiGrid) els.kpiGrid.hidden = false;
      if (els.bottomNav) els.bottomNav.hidden = false;
      if (els.partnerWorkspaceBanner) els.partnerWorkspaceBanner.hidden = true;
      if (els.topbarName) els.topbarName.textContent = "阿男 GEO 雲端後台";
      if (els.auditFormTitle) els.auditFormTitle.textContent = "手機即時健檢與對手 PK";
      if (els.auditFormBadge) els.auditFormBadge.textContent = "雲端直跑";
      if (els.auditSubmit && !els.auditSubmit.disabled) {
        els.auditSubmit.textContent = "開始雲端健檢並產出簡報";
      }
    }
  }

  function switchTab(tabName) {
    const safeTab = state.role === "partner" ? "audit" : tabName;
    state.activeTab = safeTab;
    document.querySelectorAll("[data-tab-panel]").forEach((panel) => {
      panel.hidden = panel.getAttribute("data-tab-panel") !== safeTab;
    });
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      const active = btn.getAttribute("data-tab") === safeTab;
      btn.classList.toggle("is-active", active);
      if (active) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
    if (safeTab === "posts" && state.role === "admin") {
      renderPostLivePreview();
      if (!state.postsLoaded && !state.postsLoading) {
        loadAdminPosts({ silent: true });
      }
    }
  }

  function showLoginView(passwordConfigured = true, partnerEnabled = state.partnerEnabled) {
    state.partnerEnabled = Boolean(partnerEnabled);
    document.body.classList.remove("role-partner");
    els.appView.hidden = true;
    els.loginView.hidden = false;
    if (els.loginModeTabs) {
      els.loginModeTabs.hidden = !state.partnerEnabled;
    }
    if (!state.partnerEnabled) {
      setLoginMode("admin");
    } else {
      setLoginMode(state.loginMode);
    }
    if (!passwordConfigured && !state.partnerEnabled) {
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
      { label: "合夥人免費入口（PARTNER_ACCESS_CODE）", ok: Boolean(cfg.partner_configured), okText: "已啟用", noText: "未設定（選配）" },
      { label: "雲端資料庫（D1 綁定 DB）", ok: Boolean(cfg.db_bound), okText: "已連線", noText: "未綁定（降級模式）" },
      { label: "自動追單信件（RESEND_API_KEY）", ok: Boolean(cfg.resend_configured), okText: "已啟用", noText: "預覽解鎖模式" },
      { label: "關鍵字找對手（SERPER_API_KEY）", ok: Boolean(cfg.serper_configured), okText: "Google＋地圖加速", noText: "免 Key 備用搜尋" },
      { label: "官網貼文管理（RELAY_ADMIN_TOKEN）", ok: Boolean(cfg.relay_admin_configured), okText: "已設定", noText: "未設定（選配）" },
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

  function resolveVipShareUrl() {
    const apiUrl = state.overviewSummary?.vip_delivery?.url;
    if (typeof apiUrl === "string" && /^https:\/\/anangeo\.com\/guides\/store-owner-vip\/?$/i.test(apiUrl)) {
      return apiUrl;
    }
    return "https://anangeo.com/guides/store-owner-vip/";
  }

  function buildVipDeliveryGreeting(clientName = "") {
    const cleanName = String(clientName || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40);
    const greetingHead = cleanName ? `${cleanName} 您好：` : "老闆您好：";
    const vipUrl = resolveVipShareUrl();
    return [
      greetingHead,
      "感謝您的信任與合作！這邊附上為您準備的 VIP 結案專屬贈禮《實體店網路吸客 5 堂實戰微課》（全 5 堂互動閱讀版，支援手機三行好讀排版與 15 項 3 分鐘落地練習）：",
      vipUrl,
      "",
      "這頁為客戶專屬未公開連結，建議直接存成手機書籤隨時複習。操作上有任何問題，歡迎隨時加官方 LINE @954pwtpz（阿男GEO總公司）找我們討論！",
    ].join("\n");
  }

  function renderVipDeliveryPreview() {
    if (!els.vipGreetingPreview) return;
    els.vipGreetingPreview.textContent = buildVipDeliveryGreeting(state.vipClientName);
  }

  async function copyTextWithFallback(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // 降級改用暫時 textarea 複製
      }
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "readonly");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const copied = document.execCommand("copy");
      ta.remove();
      return Boolean(copied);
    } catch {
      return false;
    }
  }

  function renderOverviewSummary(summaryData) {
    if (!summaryData || typeof summaryData !== "object") return;
    state.overviewSummary = summaryData;

    const base = summaryData.baseline || {};
    const stats = summaryData.stats || {};
    const dbConnected = Boolean(summaryData.db_connected);

    if (els.summaryStatusBadge) {
      els.summaryStatusBadge.textContent = dbConnected ? "D1 即時戰績" : "基準唯讀模式";
      els.summaryStatusBadge.className = dbConnected ? "tag-brass" : "tag-mono";
    }

    if (els.summaryHeadline) {
      els.summaryHeadline.textContent = `對齊 ${base.brand_name || "阿男音樂"}（${base.window || "公開實測基準"}）：自然露出 ${base.before_natural_mention || "0%"} → ${base.after_natural_mention || "50%"}。`;
    }

    if (els.summaryLeadsVal) {
      els.summaryLeadsVal.textContent = `${Number(stats.leads_total || 0)} 筆`;
    }
    if (els.summaryLeadsSub) {
      const avgText = stats.leads_avg_score != null ? `・均分 ${stats.leads_avg_score}` : "";
      els.summaryLeadsSub.textContent = dbConnected
        ? `近 7 天 +${Number(stats.leads_last_7d || 0)} 筆${avgText}`
        : "綁定 D1 後即時統計";
    }

    if (els.summaryAuditsVal) {
      els.summaryAuditsVal.textContent = `${Number(stats.audits_total || 0)} 次`;
    }
    if (els.summaryAuditsSub) {
      const green = Number(stats.audits_green_count || 0);
      const yellow = Number(stats.audits_yellow_count || 0);
      const red = Number(stats.audits_red_count || 0);
      els.summaryAuditsSub.textContent = dbConnected
        ? `近 7 天 +${Number(stats.audits_last_7d || 0)} 次・綠${green}/黃${yellow}/紅${red}`
        : "即時健檢免綁可用";
    }

    if (els.summarySamplesVal) {
      els.summarySamplesVal.textContent = `${Number(base.total_samples || 0).toLocaleString("en-US")} 筆`;
    }
    if (els.summarySamplesSub) {
      els.summarySamplesSub.textContent = `${Number(base.test_days || 0)} 實測日・官網 ${Number(base.site_pages_current || 0)} 頁・${Number(base.content_assets || 0)} 主題`;
    }

    if (els.summaryLightsVal) {
      els.summaryLightsVal.textContent = `${Number(base.audit_score_before || 0)}→${Number(base.audit_score_after || 0)} 分`;
    }
    if (els.summaryLightsSub) {
      els.summaryLightsSub.textContent = `入口核對：${base.after_line_accuracy || "100%"}`;
    }

    if (els.summaryUpdatedMeta) {
      const totalRecords = Number(stats.total_records || 0);
      const latestStamp = stats.latest_audit_at || stats.latest_lead_at;
      const latestText = latestStamp ? `｜最新活動 ${formatTime(latestStamp)}` : "";
      els.summaryUpdatedMeta.textContent = `雲端累計紀錄 ${totalRecords} 筆（名單＋健檢）｜來源 ${base.source || "case-cccnan.json"}｜同步時間 ${formatTime(summaryData.generated_at)}${latestText}`;
    }

    renderVipDeliveryPreview();
  }

  async function loadOverviewSummary() {
    if (state.role === "partner") return false;
    const res = await apiFetch("/api/admin/overview-summary", { method: "GET" });
    if (res.ok && res.data?.ok) {
      renderOverviewSummary(res.data);
      return true;
    }
    return false;
  }

  async function loadPartnerWorkspace() {
    const res = await apiFetch("/api/admin/me", { method: "GET" });
    if (res.status === 401) {
      showLoginView(res.data?.password_configured !== false, res.data?.partner_enabled ?? state.partnerEnabled);
      return false;
    }
    if (!res.ok || !res.data?.ok) {
      showToast(res.data?.error || "讀取合夥人工作台失敗");
      return false;
    }
    if (res.data.role === "admin") {
      return loadOverview();
    }
    showAppView();
    applyRoleView("partner", res.data.partner_name || "", res.data.rate_limit || null);
    return true;
  }

  async function loadOverview() {
    if (state.role === "partner") {
      return loadPartnerWorkspace();
    }
    const [res, summaryRes] = await Promise.all([
      apiFetch("/api/admin/overview", { method: "GET" }),
      apiFetch("/api/admin/overview-summary", { method: "GET" }).catch(() => ({ ok: false, data: null })),
    ]);
    if (res.status === 401) {
      showLoginView(res.data?.password_configured !== false, res.data?.partner_enabled ?? state.partnerEnabled);
      return false;
    }
    if (res.status === 403) {
      return loadPartnerWorkspace();
    }
    if (!res.ok || !res.data?.ok) {
      showToast(res.data?.error || "讀取總覽資料失敗");
      return false;
    }
    applyRoleView("admin");
    showAppView();
    renderOverview(res.data);
    if (summaryRes.ok && summaryRes.data?.ok) {
      renderOverviewSummary(summaryRes.data);
    }
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
    a.download = filename || "geo-boss-brief.html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function resolveBossReportBuilder() {
    if (window.AnanBossReport && typeof window.AnanBossReport.buildBossReportHtml === "function") {
      return window.AnanBossReport;
    }
    try {
      const mod = await import("/admin/boss-report.js");
      if (mod && typeof mod.buildBossReportHtml === "function") {
        window.AnanBossReport = mod;
        return mod;
      }
    } catch {
      // 降級回既有伺服器簡報 HTML
    }
    return null;
  }

  let pricingCalcModCache = null;
  let previewController = null;

  function getLoadedPricingCalc() {
    if (pricingCalcModCache) return pricingCalcModCache;
    if (window.AnanPricingCalc && typeof window.AnanPricingCalc.calculateDealBreakdown === "function") {
      pricingCalcModCache = window.AnanPricingCalc;
      return pricingCalcModCache;
    }
    return null;
  }

  async function resolvePricingCalc() {
    const loaded = getLoadedPricingCalc();
    if (loaded) return loaded;
    try {
      const mod = await import("/admin/pricing-calc.js");
      if (mod && typeof mod.calculateDealBreakdown === "function") {
        window.AnanPricingCalc = mod;
        pricingCalcModCache = mod;
        return pricingCalcModCache;
      }
    } catch {
      // 忽略載入失敗
    }
    return null;
  }

  async function ensurePreviewController() {
    if (previewController) return previewController;
    const calcMod = await resolvePricingCalc();
    if (calcMod && typeof calcMod.createReportPreviewController === "function") {
      previewController = calcMod.createReportPreviewController({
        modalEl: els.reportPreviewModal,
        titleEl: els.reportPreviewTitle,
        iframeEl: els.reportPreviewIframe,
        closeBtnEl: els.reportPreviewClose,
        onToggleBodyClass(cls, active) {
          document.body.classList.toggle(cls, Boolean(active));
        },
      });
      return previewController;
    }
    return null;
  }

  async function openReportPreview({ title, html, filename, triggerEl }) {
    if (!html) {
      showToast("目前沒有可預覽的簡報內容");
      return;
    }
    const ctrl = await ensurePreviewController();
    if (!ctrl) {
      showToast("預覽視窗元件尚未載入，請改點下載 HTML");
      return;
    }
    const ok = ctrl.open({ title, html, filename, triggerEl });
    if (!ok) {
      showToast("無法開啟 App 內預覽視窗");
    }
  }

  function closeReportPreview() {
    if (previewController) {
      previewController.close();
    } else if (els.reportPreviewModal) {
      els.reportPreviewModal.hidden = true;
      document.body.classList.remove("preview-open");
      if (els.reportPreviewIframe) {
        els.reportPreviewIframe.removeAttribute("srcdoc");
        els.reportPreviewIframe.srcdoc = "";
      }
    }
  }

  async function buildLatestAuditBriefPayload() {
    const audit = state.latestAudit;
    if (!audit?.target) return null;

    const builder = await resolveBossReportBuilder();
    if (builder) {
      const comps = Array.isArray(audit.competitors) ? audit.competitors.slice(0, MAX_COMPARE_COUNT) : [];
      const html = builder.buildBossReportHtml({
        clientName: audit.client_name,
        targetReport: audit.target,
        competitorReports: comps,
        notes: (els.auditNotes?.value || "").trim(),
        partnerName: getEffectivePartnerName(),
        generatedAt: audit.created_at || new Date().toISOString(),
      });
      const filename = builder.buildBossReportFilename({
        clientName: audit.client_name,
        targetUrl: audit.target.target_url,
        competitorCount: comps.length,
        generatedAt: audit.created_at || new Date().toISOString(),
      });
      return {
        title: `${audit.client_name || hostOnly(audit.target.target_url)}｜老闆互動簡報`,
        html,
        filename,
        competitorCount: comps.length,
      };
    }

    if (audit.report_html) {
      return {
        title: `${audit.client_name || hostOnly(audit.target.target_url)}｜單頁簡報`,
        html: audit.report_html,
        filename: audit.report_filename || "geo-boss-brief.html",
        competitorCount: Array.isArray(audit.competitors_summary) ? audit.competitors_summary.length : 0,
      };
    }
    return null;
  }

  async function buildFinderPkBriefPayload() {
    const completed = (state.finderCompareEntries || []).filter(
      (e) => e.status === "done" && e.report && typeof e.report === "object"
    );
    if (completed.length === 0) return { error: "目前沒有已完成的同業比對資料可供檢視" };

    const builder = await resolveBossReportBuilder();
    if (!builder) return { error: "簡報產生模組尚未載入，請重新整理後再試" };

    const nowIso = new Date().toISOString();
    const decorated = completed.map((entry) => ({
      ...entry.report,
      display_name: entry.title || entry.domain || hostOnly(entry.url),
    }));

    // 若下方已有完成主測站健檢，且與同業清單不重複，就以我方主測站 vs 最多 4 家同業產出 PK 簡報
    let clientName;
    let targetReport;
    let competitorReports;
    let notes = "";

    const latestTarget = state.latestAudit?.target;
    if (latestTarget && latestTarget.target_url) {
      const myHost = hostOnly(latestTarget.target_url).toLowerCase();
      clientName = state.latestAudit.client_name || hostOnly(latestTarget.target_url);
      targetReport = latestTarget;
      competitorReports = decorated
        .filter((item) => hostOnly(item.target_url).toLowerCase() !== myHost)
        .slice(0, MAX_COMPARE_COUNT);
      notes = (els.auditNotes?.value || "").trim();
    } else {
      const primary = decorated[0];
      clientName = primary.display_name || hostOnly(primary.target_url);
      targetReport = primary;
      competitorReports = decorated.slice(1, MAX_COMPARE_COUNT + 1);
      const q = (els.finderQuery?.value || "").trim();
      if (q) notes = `關鍵字「${q}」同業即時比對簡報`;
    }

    const html = builder.buildBossReportHtml({
      clientName,
      targetReport,
      competitorReports,
      notes,
      partnerName: getEffectivePartnerName(),
      generatedAt: nowIso,
    });
    const filename = builder.buildBossReportFilename({
      clientName,
      targetUrl: targetReport.target_url,
      competitorCount: competitorReports.length,
      generatedAt: nowIso,
    });
    return {
      title:
        competitorReports.length > 0
          ? `${clientName}｜同業 PK 簡報（${competitorReports.length} 家對手）`
          : `${clientName}｜老闆互動簡報`,
      html,
      filename,
      competitorCount: competitorReports.length,
    };
  }

  async function previewFinderPkReport(triggerEl) {
    const payload = await buildFinderPkBriefPayload();
    if (!payload || payload.error) {
      showToast(payload?.error || "目前沒有可預覽的同業比對簡報");
      return;
    }
    await openReportPreview({
      title: payload.title,
      html: payload.html,
      filename: payload.filename,
      triggerEl,
    });
  }

  async function downloadFinderPkReport() {
    const payload = await buildFinderPkBriefPayload();
    if (!payload || payload.error) {
      showToast(payload?.error || "目前沒有已完成的同業比對資料可供下載");
      return;
    }
    downloadHtmlFile(payload.filename, payload.html);
    showToast(
      payload.competitorCount > 0
        ? `已下載同業 PK 超炫老闆簡報（含 ${payload.competitorCount} 家對手）`
        : "已下載單站超炫老闆簡報（HTML）"
    );
  }

  // ==================== 工作區子分頁與方案分潤試算 ====================
  function switchWorkTab(workTab) {
    const next = workTab === "pricing-calc" ? "pricing-calc" : "audit-tools";
    state.activeWorkTab = next;
    if (els.workspaceSubtabs) {
      els.workspaceSubtabs.querySelectorAll("[data-work-tab]").forEach((btn) => {
        const active = btn.getAttribute("data-work-tab") === next;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-selected", active ? "true" : "false");
      });
    }
    if (els.auditToolsPanel) els.auditToolsPanel.hidden = next !== "audit-tools";
    if (els.pricingCalcPanel) els.pricingCalcPanel.hidden = next !== "pricing-calc";
    if (next === "pricing-calc") {
      renderPricingCalculator();
    }
  }

  function renderPricingCalculator() {
    const loaded = getLoadedPricingCalc();
    if (!loaded) {
      resolvePricingCalc().then((mod) => {
        if (mod) renderPricingCalculatorWithMod(mod);
      });
      return;
    }
    renderPricingCalculatorWithMod(loaded);
  }

  function renderPricingCalculatorWithMod(calcMod) {
    if (!calcMod || !els.calcPlanList) return;

    const currentPlan = calcMod.findPlan(state.calc.planId);
    const breakdown = calcMod.calculateDealBreakdown({
      planId: state.calc.planId,
      adjustmentId: state.calc.adjustmentId,
      tierId: state.calc.tierId,
      customDirectCost: state.calc.customDirectCost === null ? undefined : state.calc.customDirectCost,
    });

    // 1. 方案按鈕列
    els.calcPlanList.innerHTML = calcMod.PLANS.map((plan) => {
      const selected = plan.id === breakdown.plan.id;
      return `
        <button
          type="button"
          class="calc-opt-btn${selected ? " is-selected" : ""}"
          data-calc-plan="${escapeHtml(plan.id)}"
          role="radio"
          aria-checked="${selected ? "true" : "false"}"
        >
          <div class="calc-opt-top">
            <span class="calc-opt-title">${escapeHtml(plan.name)}</span>
            <span class="calc-opt-price mono">${escapeHtml(calcMod.formatNtd(plan.price))}${escapeHtml(plan.unitLabel)}</span>
          </div>
          <span class="calc-opt-desc">${escapeHtml(plan.summary)}</span>
        </button>`;
    }).join("");

    // 2. 專案折抵／減免按鈕列
    els.calcAdjustmentList.innerHTML = calcMod.ADJUSTMENTS.map((adj) => {
      const selected = adj.id === breakdown.adjustment.id;
      return `
        <button
          type="button"
          class="calc-opt-btn${selected ? " is-selected" : ""}"
          data-calc-adjustment="${escapeHtml(adj.id)}"
          role="radio"
          aria-checked="${selected ? "true" : "false"}"
        >
          <div class="calc-opt-top">
            <span class="calc-opt-title">${escapeHtml(adj.label)}</span>
          </div>
          <span class="calc-opt-desc">${escapeHtml(adj.shortDesc)}</span>
        </button>`;
    }).join("");

    if (els.calcAdjustmentNote) {
      if (breakdown.adjustmentNote) {
        els.calcAdjustmentNote.textContent = breakdown.adjustmentNote;
        els.calcAdjustmentNote.className = breakdown.adjustmentApplied
          ? "notice-banner notice-info"
          : "notice-banner notice-warn";
        els.calcAdjustmentNote.hidden = false;
      } else {
        els.calcAdjustmentNote.hidden = true;
      }
    }

    // 3. 合夥人合作模式按鈕列
    els.calcTierList.innerHTML = calcMod.PARTNER_TIERS.map((tier) => {
      const selected = tier.id === breakdown.tier.id;
      return `
        <button
          type="button"
          class="calc-opt-btn${selected ? " is-selected" : ""}"
          data-calc-tier="${escapeHtml(tier.id)}"
          role="radio"
          aria-checked="${selected ? "true" : "false"}"
        >
          <div class="calc-opt-top">
            <span class="calc-opt-title">${escapeHtml(tier.label)}</span>
            <span class="calc-opt-price mono">${tier.ratePct}%</span>
          </div>
          <span class="calc-opt-desc">${escapeHtml(tier.shortDesc)}</span>
        </button>`;
    }).join("");

    // 4. 必要實支輸入框與說明
    if (els.calcDirectCost && document.activeElement !== els.calcDirectCost) {
      els.calcDirectCost.value = String(breakdown.directCost);
    }
    if (els.calcCostHint) {
      els.calcCostHint.textContent = currentPlan.directCostHint;
    }

    // 5. 即時試算輸出卡片
    const unit = breakdown.unitLabel === "／月" ? "／月" : "";
    if (els.calcOutClient) {
      els.calcOutClient.textContent = `${calcMod.formatNtd(breakdown.clientPayable)}${unit}`;
    }
    if (els.calcOutClientSub) {
      els.calcOutClientSub.textContent =
        breakdown.adjustmentAmount > 0
          ? `原價 ${calcMod.formatNtd(breakdown.basePrice)} − 減免 ${calcMod.formatNtd(breakdown.adjustmentAmount)}`
          : `標準原價 ${calcMod.formatNtd(breakdown.basePrice)}`;
    }
    if (els.calcOutPartner) {
      els.calcOutPartner.textContent = `${calcMod.formatNtd(breakdown.partnerCommission)}${unit}`;
    }
    if (els.calcOutPartnerSub) {
      els.calcOutPartnerSub.textContent = `${breakdown.tier.label}・依淨額 ${calcMod.formatNtd(breakdown.distributableNet)} 計算`;
    }
    if (els.calcOutAnan) {
      els.calcOutAnan.textContent = `${calcMod.formatNtd(breakdown.ananNetProfit)}${unit}`;
    }
    if (els.calcOutAnanSub) {
      els.calcOutAnanSub.textContent = `已扣必要實支 ${calcMod.formatNtd(breakdown.directCost)} 與分潤`;
    }
    if (els.calcBreakdownBar) {
      els.calcBreakdownBar.textContent = `明細核對：客戶實付 ${calcMod.formatNtd(breakdown.clientPayable)} − 必要實支 ${calcMod.formatNtd(breakdown.directCost)} ＝ 可分配淨額 ${calcMod.formatNtd(breakdown.distributableNet)} → 合夥人 ${calcMod.formatNtd(breakdown.partnerCommission)} ＋ 阿男實拿 ${calcMod.formatNtd(breakdown.ananNetProfit)}。`;
    }

    // 6. 給客戶看的白話 LINE 報價文字預覽（嚴格不含內部成本與分潤）
    if (els.calcQuotePreview) {
      els.calcQuotePreview.textContent = calcMod.buildClientQuoteText({
        planId: breakdown.plan.id,
        adjustmentId: breakdown.adjustment.id,
        clientName: state.calc.clientName,
        partnerName: getEffectivePartnerName(),
      });
    }
  }

  async function copyCalcQuote() {
    const calcMod = await resolvePricingCalc();
    if (!calcMod) return;
    const text = calcMod.buildClientQuoteText({
      planId: state.calc.planId,
      adjustmentId: state.calc.adjustmentId,
      clientName: state.calc.clientName,
      partnerName: getEffectivePartnerName(),
    });
    try {
      await navigator.clipboard.writeText(text);
      showToast("已複製白話報價文字，可直接貼進 LINE 傳給客戶");
    } catch {
      showToast("無法自動複製，請長按上方報價文字複製");
    }
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
    const partnerSig = getEffectivePartnerName();
    if (partnerSig) {
      lines.push("", `推薦協助健檢窗口：${partnerSig}`);
    }
    return lines.join("\n");
  }

  // ==================== 官網貼文管理（列表預覽／新增發布／二次確認刪除） ====================
  function sanitizePreviewHttpUrl(raw) {
    const text = String(raw || "").trim();
    if (!text) return "";
    try {
      const parsed = new URL(text);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
      return parsed.toString();
    } catch {
      return "";
    }
  }

  function formatTodayDateTaipei() {
    const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    const d = String(now.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function renderPostLivePreview() {
    if (!els.postLivePreview) return;
    const title = (els.postTitle?.value || "").trim() || "這裡會即時顯示貼文標題";
    const summary =
      (els.postSummary?.value || "").trim() ||
      "輸入貼文摘要後，這裡會直接模擬官網首頁深海金綠動態卡片的呈現效果。";
    const price = (els.postPrice?.value || "").trim();
    const safeImg = sanitizePreviewHttpUrl(els.postImageUrl?.value || "");
    const willThreads = Boolean(els.postPublishThreads?.checked);

    const mediaHtml = safeImg
      ? `<div class="relay-preview-media"><img src="${escapeHtml(safeImg)}" alt="${escapeHtml(title)}" loading="lazy"></div>`
      : "";
    const priceBadge = price ? `<span class="relay-preview-price">${escapeHtml(price)}</span>` : "";
    const footHtml = willThreads
      ? `<div class="relay-preview-foot">查看 Threads 原文 →（發布後自動帶入）</div>`
      : "";

    els.postLivePreview.innerHTML = `
      <article class="relay-preview-card">
        ${mediaHtml}
        <div class="relay-preview-body">
          <div class="relay-preview-meta">
            <span class="relay-preview-date">${escapeHtml(formatTodayDateTaipei())}</span>
            ${priceBadge}
          </div>
          <h3 class="relay-preview-title">${escapeHtml(title)}</h3>
          <p class="relay-preview-summary">${escapeHtml(summary)}</p>
          ${footHtml}
        </div>
      </article>`;
  }

  function renderAdminPostsList() {
    if (!els.postsList) return;
    const list = Array.isArray(state.posts) ? state.posts : [];
    if (els.postsCountBadge) {
      els.postsCountBadge.textContent = `${list.length} 則`;
    }
    if (list.length === 0) {
      els.postsList.innerHTML =
        '<div class="empty-state">目前還沒有官網貼文，填寫上方表單按「🚀 立即發布」就會立刻出現在首頁。</div>';
      return;
    }

    els.postsList.innerHTML = list
      .map((item) => {
        const id = String(item.id || "");
        const safeImg = sanitizePreviewHttpUrl(item.image_url || "");
        const safePermalink = sanitizePreviewHttpUrl(item.threads_permalink || "");
        const hasThreads = Boolean(item.threads_post_id || safePermalink);
        const isArchived = item.status === "archived";
        const isConfirming = state.postsConfirmDeleteId === id;
        const isDeleting = state.postsDeletingId === id;

        const thumbHtml = safeImg
          ? `<div class="post-thumb"><img src="${escapeHtml(safeImg)}" alt="${escapeHtml(item.title || "貼文縮圖")}" loading="lazy"></div>`
          : "";
        const priceHtml = item.price_summary
          ? `<span class="tag-brass">${escapeHtml(item.price_summary)}</span>`
          : "";
        const statusHtml = isArchived
          ? `<span class="post-badge-site">已封存</span>`
          : `<span class="score-pill score-green">顯示中</span>`;
        const threadsHtml = hasThreads
          ? safePermalink
            ? `<a class="post-badge-threads" href="${escapeHtml(safePermalink)}" target="_blank" rel="noopener noreferrer">已發 Threads ↗</a>`
            : `<span class="post-badge-threads">已發 Threads</span>`
          : `<span class="post-badge-site">僅官網顯示</span>`;

        const confirmBar = isConfirming
          ? `<div class="post-confirm-bar" role="region" aria-label="確認刪除貼文">
              <span>確定要從官網刪除這則貼文嗎？刪除後無法復原。</span>
              <div class="post-confirm-actions">
                <button type="button" class="ghost-mini" data-cancel-delete-post-id="${escapeHtml(id)}" ${isDeleting ? "disabled" : ""}>取消</button>
                <button type="button" class="btn-danger-mini" data-confirm-delete-post-id="${escapeHtml(id)}" ${isDeleting ? "disabled" : ""}>${isDeleting ? "刪除中…" : "確認刪除"}</button>
              </div>
            </div>`
          : "";

        return `
          <article class="post-item-card" data-post-id="${escapeHtml(id)}">
            <div class="post-item-main">
              ${thumbHtml}
              <div class="post-item-content">
                <h3 class="post-item-title">${escapeHtml(item.title || "未命名貼文")}</h3>
                ${item.summary ? `<p class="post-item-summary">${escapeHtml(item.summary)}</p>` : ""}
                <div class="post-badges">
                  ${statusHtml}
                  ${threadsHtml}
                  ${priceHtml}
                </div>
              </div>
            </div>
            <div class="post-item-footer">
              <span class="record-meta mono">發布時間：${escapeHtml(formatTime(item.published_at || item.updated_at))}</span>
              <button
                type="button"
                class="btn-danger-mini"
                data-delete-post-id="${escapeHtml(id)}"
                ${isDeleting ? "disabled" : ""}
              >
                🗑️ 刪除
              </button>
            </div>
            ${confirmBar}
          </article>`;
      })
      .join("");
  }

  async function loadAdminPosts({ silent = false } = {}) {
    if (state.role !== "admin" || !els.postsList) return false;
    state.postsLoading = true;
    if (els.postsRefreshBtn) {
      els.postsRefreshBtn.disabled = true;
      els.postsRefreshBtn.textContent = "載入中…";
    }
    if (els.postsListNotice) els.postsListNotice.hidden = true;
    if (!state.postsLoaded) {
      els.postsList.innerHTML = '<div class="empty-state">正在讀取目前官網貼文…</div>';
    }

    try {
      const res = await apiFetch("/api/admin/promotions", { method: "GET" });
      if (res.status === 401) {
        showLoginView(true, state.partnerEnabled);
        showToast("登入階段已逾時，請重新登入");
        return false;
      }
      if (!res.ok) {
        state.postsLoaded = true;
        state.posts = [];
        renderAdminPostsList();
        if (els.postsListNotice) {
          els.postsListNotice.textContent =
            res.data?.error ||
            (res.status === 503
              ? "尚未設定官網貼文管理權杖（RELAY_ADMIN_TOKEN），請於 Cloudflare Workers 後台設定後再整理。"
              : `讀取官網貼文失敗（HTTP ${res.status}）。`);
          els.postsListNotice.hidden = false;
        }
        return false;
      }

      const list = Array.isArray(res.data?.promotions) ? res.data.promotions : [];
      state.posts = list;
      state.postsLoaded = true;
      state.postsConfirmDeleteId = null;
      renderAdminPostsList();
      if (!silent) {
        showToast(`已更新官網貼文（共 ${list.length} 則）`);
      }
      return true;
    } catch {
      if (els.postsListNotice) {
        els.postsListNotice.textContent = "連線貼文服務暫時失敗，請稍後按「重新整理」再試。";
        els.postsListNotice.hidden = false;
      }
      return false;
    } finally {
      state.postsLoading = false;
      if (els.postsRefreshBtn) {
        els.postsRefreshBtn.disabled = false;
        els.postsRefreshBtn.textContent = "🔄 重新整理";
      }
    }
  }

  async function deleteAdminPost(promoId) {
    if (!promoId || state.postsDeletingId) return;
    state.postsDeletingId = promoId;
    renderAdminPostsList();

    try {
      const res = await apiFetch(`/api/admin/promotions?id=${encodeURIComponent(promoId)}`, {
        method: "DELETE",
      });
      if (res.status === 401) {
        showLoginView(true, state.partnerEnabled);
        showToast("登入階段已逾時，請重新登入");
        return;
      }
      if (!res.ok) {
        showToast(res.data?.error || `刪除失敗（HTTP ${res.status}）`);
        return;
      }
      state.postsConfirmDeleteId = null;
      state.postsDeletingId = null;
      showToast("已從官網刪除貼文");
      await loadAdminPosts({ silent: true });
    } catch {
      showToast("刪除時網路連線失敗，請稍後再試");
    } finally {
      state.postsDeletingId = null;
      renderAdminPostsList();
    }
  }

  // ==================== 事件綁定 ====================
  if (els.loginModeTabs) {
    els.loginModeTabs.addEventListener("click", (evt) => {
      const btn = evt.target.closest("[data-login-mode]");
      if (!btn) return;
      setLoginMode(btn.getAttribute("data-login-mode") || "admin");
    });
  }

  if (els.partnerSignatureInput) {
    els.partnerSignatureInput.addEventListener("input", () => {
      const sig = els.partnerSignatureInput.value.replace(/\s+/g, " ").trim().slice(0, 40);
      state.partnerName = sig;
      if (state.role === "partner" && els.dbStatusPill) {
        els.dbStatusPill.textContent = sig ? `合夥人・${sig}` : "合夥人免費入口";
      }
      if (state.activeWorkTab === "pricing-calc") {
        renderPricingCalculator();
      }
    });
  }

  els.togglePwBtn.addEventListener("click", () => {
    const isPw = els.loginPassword.type === "password";
    els.loginPassword.type = isPw ? "text" : "password";
    els.togglePwBtn.textContent = isPw ? "隱藏" : "顯示";
  });

  els.loginForm.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    els.loginError.hidden = true;
    const password = els.loginPassword.value || "";
    const partnerNameInput = (els.loginPartnerName?.value || "").trim();
    if (!password) {
      els.loginError.textContent =
        state.loginMode === "partner" ? "請先輸入合夥人專用口令。" : "請先輸入管理密碼。";
      els.loginError.hidden = false;
      return;
    }

    els.loginSubmit.disabled = true;
    els.loginSubmit.textContent = "驗證中…";
    try {
      const res = await apiFetch("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({
          password,
          ...(partnerNameInput ? { partner_name: partnerNameInput } : {}),
        }),
      });
      if (!res.ok || !res.data?.ok) {
        els.loginError.textContent = res.data?.error || "登入失敗，請重新確認密碼或口令。";
        els.loginError.hidden = false;
        return;
      }
      els.loginPassword.value = "";
      if (res.data.role === "partner") {
        await loadPartnerWorkspace();
        showToast("已進入合夥人工作台");
      } else {
        await loadOverview();
        switchTab("overview");
        showToast("已進入雲端後台");
      }
    } finally {
      els.loginSubmit.disabled = false;
      els.loginSubmit.textContent = state.loginMode === "partner" ? "進入合夥人工作台" : "進入雲端後台";
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
    state.finderCompareEntries = [];
    state.finderSearching = false;
    state.finderComparing = false;
    if (els.finderNotice) els.finderNotice.hidden = true;
    if (els.finderError) els.finderError.hidden = true;
    if (els.finderResultsWrap) els.finderResultsWrap.hidden = true;
    if (els.finderCompareWrap) els.finderCompareWrap.hidden = true;
    if (els.finderCompareActions) els.finderCompareActions.hidden = true;
    if (els.finderCandidatesList) els.finderCandidatesList.innerHTML = "";
    if (els.finderCompareResults) els.finderCompareResults.innerHTML = "";
  }

  els.logoutBtn.addEventListener("click", async () => {
    closeReportPreview();
    await apiFetch("/api/admin/logout", { method: "POST", body: "{}" });
    state.role = null;
    state.partnerName = "";
    state.partnerRateLimit = null;
    state.overview = null;
    state.latestAudit = null;
    clearAdminOnlyDom();
    resetFinderState();
    switchWorkTab("audit-tools");
    els.auditResultBox.hidden = true;
    showLoginView(true, state.partnerEnabled);
    showToast("已安全登出");
  });

  els.refreshBtn.addEventListener("click", async () => {
    showToast("更新資料中…");
    if (state.role === "partner") {
      const ok = await loadPartnerWorkspace();
      if (ok) showToast("已更新合夥人工作台狀態");
      return;
    }
    const ok = await loadOverview();
    if (state.activeTab === "posts") {
      await loadAdminPosts({ silent: true });
    }
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
      switchWorkTab("audit-tools");
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
    const competitorUrls = [...checkedPresets, ...customLines].slice(0, MAX_COMPARE_COUNT);

    const defaultAuditBtnText =
      state.role === "partner" ? "開始 10 秒健檢並產出簡報" : "開始雲端健檢並產出簡報";

    els.auditSubmit.disabled = true;
    els.auditSubmit.textContent =
      state.role === "partner" ? "10 秒即時健檢中…" : "雲端檢測與產生簡報中…";
    try {
      // 合夥人模式：全程透過公開 /api/check 與純前端簡報產生器執行，絕不寫入或存取站長總庫
      if (state.role === "partner") {
        const targetRes = await apiFetch(`/api/check?url=${encodeURIComponent(targetUrl)}`, {
          method: "GET",
        });
        if (!targetRes.ok || !targetRes.data?.ok) {
          els.auditError.textContent = targetRes.data?.error || "健檢失敗，請確認客戶網址可公開讀取。";
          els.auditError.hidden = false;
          return;
        }

        const targetReport = targetRes.data;
        const dedupCompUrls = [];
        const seenUrls = new Set([targetReport.target_url]);
        for (const rawComp of competitorUrls) {
          if (dedupCompUrls.length >= MAX_COMPARE_COUNT) break;
          if (rawComp && !seenUrls.has(rawComp)) {
            seenUrls.add(rawComp);
            dedupCompUrls.push(rawComp);
          }
        }

        const compResponses = await Promise.all(
          dedupCompUrls.map((compUrl) =>
            apiFetch(`/api/check?url=${encodeURIComponent(compUrl)}`, { method: "GET" }).catch(() => ({
              ok: false,
              data: null,
            }))
          )
        );
        const competitorReports = compResponses
          .filter((r) => r.ok && r.data?.ok && r.data.target_url !== targetReport.target_url)
          .map((r) => r.data);

        const compactCompetitors = competitorReports.map((c) => ({
          target_url: c.target_url,
          score: c.score,
          grade_light: c.grade_light,
          diff: targetReport.score - c.score,
          robots_score: c.checks?.robots?.score ?? 0,
          llms_score: c.checks?.llms?.score ?? 0,
          homepage_score: c.checks?.homepage?.score ?? 0,
        }));

        const clientName = (els.auditClientName.value || "").trim() || hostOnly(targetReport.target_url);
        const generatedAt = new Date().toISOString();
        const partnerSig = getEffectivePartnerName();
        renderLatestAudit({
          ok: true,
          client_name: clientName,
          created_at: generatedAt,
          target: targetReport,
          competitors: competitorReports,
          competitors_summary: compactCompetitors,
          storage_notice: `已完成 10 秒即時健檢；下載簡報將自動帶入合夥人推薦署名「${partnerSig}」。`,
        });
        showToast("10 秒健檢完成，簡報已自動帶入合夥人署名");
        return;
      }

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
        showLoginView(true, state.partnerEnabled);
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
      els.auditSubmit.textContent = defaultAuditBtnText;
    }
  });

  if (els.previewLatestReport) {
    els.previewLatestReport.addEventListener("click", async () => {
      const payload = await buildLatestAuditBriefPayload();
      if (!payload) {
        showToast("目前沒有可預覽的簡報");
        return;
      }
      await openReportPreview({
        title: payload.title,
        html: payload.html,
        filename: payload.filename,
        triggerEl: els.previewLatestReport,
      });
    });
  }

  els.downloadLatestReport.addEventListener("click", async () => {
    const payload = await buildLatestAuditBriefPayload();
    if (!payload) {
      showToast("目前沒有可下載的簡報");
      return;
    }
    downloadHtmlFile(payload.filename, payload.html);
    showToast(
      payload.competitorCount > 0
        ? `已下載超炫老闆 PK 簡報（含 ${payload.competitorCount} 家對手）`
        : "已下載超炫老闆簡報（HTML）"
    );
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
          showLoginView(true, state.partnerEnabled);
          showToast("登入階段已逾時，請重新登入");
          return;
        }
        if (res.data?.rate_limit) {
          renderPartnerQuota(res.data.rate_limit);
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

      // 同步帶入下方「手機健檢/PK」對手欄位（最多 4 家供完整 PK 簡報使用）
      if (els.auditCompetitorsText) {
        els.auditCompetitorsText.value = selected
          .slice(0, MAX_COMPARE_COUNT)
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
      state.finderCompareEntries = entries;
      if (els.finderCompareActions) els.finderCompareActions.hidden = true;
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

        const doneCount = entries.filter((e) => e.status === "done" && e.report).length;
        if (els.finderCompareActions) {
          els.finderCompareActions.hidden = doneCount === 0;
        }
        if (els.finderCompareStatus) {
          els.finderCompareStatus.textContent = `已完成 ${entries.length} 家比對`;
        }
        showToast(`已完成 ${entries.length} 家同業即時健檢比對，可直接下載超炫 PK 簡報`);
      } finally {
        state.finderComparing = false;
        updateFinderSelectionUi();
      }
    });
  }

  if (els.previewFinderPkReport) {
    els.previewFinderPkReport.addEventListener("click", () => {
      previewFinderPkReport(els.previewFinderPkReport);
    });
  }

  if (els.downloadFinderPkReport) {
    els.downloadFinderPkReport.addEventListener("click", () => {
      downloadFinderPkReport();
    });
  }

  if (els.reportPreviewClose) {
    els.reportPreviewClose.addEventListener("click", () => {
      closeReportPreview();
    });
  }

  if (els.reportPreviewDownload) {
    els.reportPreviewDownload.addEventListener("click", () => {
      const active = previewController?.getActiveBrief();
      if (!active || !active.html) {
        showToast("目前沒有可下載的預覽簡報");
        return;
      }
      downloadHtmlFile(active.filename, active.html);
      showToast("已下載超炫老闆簡報（HTML），可直接傳進 LINE");
    });
  }

  document.addEventListener("keydown", (evt) => {
    if (evt.key === "Escape" && previewController?.isOpen()) {
      evt.preventDefault();
      closeReportPreview();
    }
  });

  if (els.workspaceSubtabs) {
    els.workspaceSubtabs.addEventListener("click", (evt) => {
      const btn = evt.target.closest("[data-work-tab]");
      if (!btn) return;
      switchWorkTab(btn.getAttribute("data-work-tab") || "audit-tools");
    });
  }

  if (els.calcPlanList) {
    els.calcPlanList.addEventListener("click", (evt) => {
      const btn = evt.target.closest("[data-calc-plan]");
      if (!btn) return;
      state.calc.planId = btn.getAttribute("data-calc-plan") || "turnkey_25000";
      state.calc.customDirectCost = null;
      renderPricingCalculator();
    });
  }

  if (els.calcAdjustmentList) {
    els.calcAdjustmentList.addEventListener("click", (evt) => {
      const btn = evt.target.closest("[data-calc-adjustment]");
      if (!btn) return;
      state.calc.adjustmentId = btn.getAttribute("data-calc-adjustment") || "none";
      renderPricingCalculator();
    });
  }

  if (els.calcTierList) {
    els.calcTierList.addEventListener("click", (evt) => {
      const btn = evt.target.closest("[data-calc-tier]");
      if (!btn) return;
      state.calc.tierId = btn.getAttribute("data-calc-tier") || "intro_25";
      renderPricingCalculator();
    });
  }

  if (els.calcDirectCost) {
    els.calcDirectCost.addEventListener("input", () => {
      const raw = els.calcDirectCost.value.trim();
      state.calc.customDirectCost = raw === "" ? 0 : Number(raw);
      renderPricingCalculator();
    });
  }

  if (els.calcCostReset) {
    els.calcCostReset.addEventListener("click", () => {
      state.calc.customDirectCost = null;
      renderPricingCalculator();
      showToast("已恢復此方案預設必要實支");
    });
  }

  if (els.calcClientName) {
    els.calcClientName.addEventListener("input", () => {
      state.calc.clientName = els.calcClientName.value || "";
      renderPricingCalculator();
    });
  }

  if (els.calcCopyQuote) {
    els.calcCopyQuote.addEventListener("click", () => {
      copyCalcQuote();
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

  // 官網貼文分頁事件（即時預覽、新增發布、列表重新整理與二次確認刪除）
  for (const inputEl of [els.postTitle, els.postSummary, els.postPrice, els.postImageUrl, els.postPublishThreads]) {
    if (inputEl) {
      inputEl.addEventListener("input", renderPostLivePreview);
      inputEl.addEventListener("change", renderPostLivePreview);
    }
  }

  if (els.postsRefreshBtn) {
    els.postsRefreshBtn.addEventListener("click", () => {
      loadAdminPosts({ silent: false });
    });
  }

  if (els.postCreateForm) {
    els.postCreateForm.addEventListener("submit", async (evt) => {
      evt.preventDefault();
      if (state.postsSubmitting) return;
      if (els.postFormError) els.postFormError.hidden = true;
      if (els.postFormStatus) els.postFormStatus.hidden = true;

      const title = (els.postTitle?.value || "").trim();
      const summary = (els.postSummary?.value || "").trim();
      const priceSummary = (els.postPrice?.value || "").trim();
      const imageUrl = (els.postImageUrl?.value || "").trim();
      const publishToThreads = Boolean(els.postPublishThreads?.checked);

      if (!title) {
        if (els.postFormError) {
          els.postFormError.textContent = "請填寫貼文標題。";
          els.postFormError.hidden = false;
        }
        return;
      }
      if (!summary) {
        if (els.postFormError) {
          els.postFormError.textContent = "請填寫貼文內容摘要。";
          els.postFormError.hidden = false;
        }
        return;
      }
      if (imageUrl && !sanitizePreviewHttpUrl(imageUrl)) {
        if (els.postFormError) {
          els.postFormError.textContent = "圖片網址請填寫有效的 https:// 或 http:// 公開連結。";
          els.postFormError.hidden = false;
        }
        return;
      }

      state.postsSubmitting = true;
      if (els.postSubmitBtn) {
        els.postSubmitBtn.disabled = true;
        els.postSubmitBtn.textContent = publishToThreads ? "發布到官網與 Threads 中…" : "發布到官網中…";
      }

      try {
        const res = await apiFetch("/api/admin/promotions", {
          method: "POST",
          body: JSON.stringify({
            title,
            summary,
            price_summary: priceSummary,
            image_url: imageUrl,
            publish_to_threads: publishToThreads,
          }),
        });
        if (res.status === 401) {
          showLoginView(true, state.partnerEnabled);
          showToast("登入階段已逾時，請重新登入");
          return;
        }
        if (!res.ok || res.data?.ok === false) {
          if (els.postFormError) {
            els.postFormError.textContent = res.data?.error || `發布失敗（HTTP ${res.status}），請稍後再試。`;
            els.postFormError.hidden = false;
          }
          return;
        }

        els.postCreateForm.reset();
        renderPostLivePreview();

        const threadsErr = res.data?.threads_error;
        const statusMsg = threadsErr
          ? `已成功發布到官網首頁！（同步 Threads 未完成：${threadsErr}）`
          : publishToThreads
            ? "已成功發布到官網首頁並同步送出至 Threads！"
            : "已成功發布到官網首頁！約 1 分鐘內首頁訪客即可看到新貼文。";
        if (els.postFormStatus) {
          els.postFormStatus.textContent = statusMsg;
          els.postFormStatus.className = threadsErr ? "notice-banner notice-warn" : "notice-banner notice-info";
          els.postFormStatus.hidden = false;
        }
        showToast("官網貼文發布成功");
        await loadAdminPosts({ silent: true });
      } catch {
        if (els.postFormError) {
          els.postFormError.textContent = "網路連線異常，發布未完成，請稍後再試。";
          els.postFormError.hidden = false;
        }
      } finally {
        state.postsSubmitting = false;
        if (els.postSubmitBtn) {
          els.postSubmitBtn.disabled = false;
          els.postSubmitBtn.textContent = "🚀 立即發布";
        }
      }
    });
  }

  if (els.postsList) {
    els.postsList.addEventListener("click", (evt) => {
      const delBtn = evt.target.closest("[data-delete-post-id]");
      if (delBtn) {
        const id = delBtn.getAttribute("data-delete-post-id") || "";
        if (!id) return;
        state.postsConfirmDeleteId = state.postsConfirmDeleteId === id ? null : id;
        renderAdminPostsList();
        return;
      }
      const cancelBtn = evt.target.closest("[data-cancel-delete-post-id]");
      if (cancelBtn) {
        state.postsConfirmDeleteId = null;
        renderAdminPostsList();
        return;
      }
      const confirmBtn = evt.target.closest("[data-confirm-delete-post-id]");
      if (confirmBtn) {
        const id = confirmBtn.getAttribute("data-confirm-delete-post-id") || "";
        if (id) deleteAdminPost(id);
      }
    });
  }

  if (els.vipClientName) {
    els.vipClientName.addEventListener("input", () => {
      state.vipClientName = els.vipClientName.value || "";
      renderVipDeliveryPreview();
    });
  }

  if (els.vipCopyLinkBtn) {
    els.vipCopyLinkBtn.addEventListener("click", async () => {
      const greetingText = buildVipDeliveryGreeting(state.vipClientName);
      const copied = await copyTextWithFallback(greetingText);
      const msg = copied
        ? "已複製 VIP 專屬學習連結與結案問候語，可直接貼進 LINE 傳給老闆！"
        : "已準備好結案問候語，請長按上方預覽框全選複製。";
      if (els.vipCopyFeedback) {
        els.vipCopyFeedback.textContent = msg;
      }
      showToast(copied ? "已複製 VIP 專屬學習連結（含結案問候語）" : "請手動複製上方問候語");
    });
  }

  // 啟動檢查：呼叫 /api/admin/session（固定 HTTP 200，確保未登入時 0 console error）
  async function bootstrap() {
    renderPricingCalculator();
    renderPostLivePreview();
    renderVipDeliveryPreview();
    const res = await apiFetch("/api/admin/session", { method: "GET" });
    state.partnerEnabled = Boolean(res.data?.partner_enabled);
    if (res.ok && res.data?.authenticated) {
      if (res.data.role === "partner") {
        await loadPartnerWorkspace();
      } else {
        await loadOverview();
      }
    } else {
      showLoginView(res.data?.password_configured !== false, state.partnerEnabled);
    }
  }

  bootstrap();
})();
