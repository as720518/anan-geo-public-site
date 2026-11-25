# 阿男 GEO 實戰工坊（純靜態公開網站雛形）

獨立、純靜態、免資料庫、0 元可託管於 GitHub Pages 的「阿男 GEO 實戰工坊」網站專案。

## 專案結構

```text
.
├── index.html              # 主頁（首頁理念、互動實戰案例儀表板、3 篇白話教學、3 階方案與聯絡入口）
├── styles.css              # 高對比深色 × 暖金商務 RWD 樣式（零外部字型／CDN 依賴）
├── app.js                  # 原生 ES6 互動控制（切換 AI 引擎、6 維體檢、文章篩選、複製 LINE ID）
├── data/case-cccnan.json   # 第 1 號去敏實戰案例資料（cccnan.art｜阿男音樂）
├── llms.txt                # 站點 AI 導讀摘要檔
├── robots.txt              # 放行主流 AI 檢索爬蟲設定
├── .nojekyll               # GitHub Pages 純靜態標記
└── LICENSE                 # MIT 授權（保留 GeoLook 上游著作權聲明）
```

## 本機預覽

不需安裝任何前端框架或資料庫，使用 Python 內建伺服器即可預覽：

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

開啟瀏覽器瀏覽 `http://127.0.0.1:8080/` 即可。

## 0 元託管部署方式（GitHub Pages）

1. 建立公開 GitHub repository，將本資料夾內容推送至預設分支（如 `main`）。
2. 在 GitHub 專案設定 **Settings → Pages → Build and deployment** 選擇 `Deploy from a branch`，分支選 `main`、資料夾選 `/ (root)`。
3. 儲存後即可透過 GitHub Pages 免費 HTTPS 網址上線（可依需求綁定自訂網域）。

## 隱私與開源邊界

- 本站所有公開案例皆經嚴格去敏，不包含任何委託人姓名、私人故事、API 金鑰、Token 或本機檔案路徑。
- 本站之 GEO 6 維體檢與工作流理念基於開源專案 [GeoLook](https://github.com/aigclink/geolook)（MIT License）延伸改作，屬獨立實戰分享，不代表原作者官方服務或背書。
- 本站明文宣告不保證 AI 排名或推薦結果，僅交付可驗證之原始問答證據、診斷報告與結構化檔案。
