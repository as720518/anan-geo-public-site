# 阿男手機複製即用：Meta Threads 正式上線（Live Mode）送審步驟懶人包

這份懶人包讓阿男直接在手機或電腦照著「複製 → 貼上」，完成 **Meta Threads App 審查並切換成正式上線（Live Mode）**。切換正式上線後，妹妹（夏朵 SPA）與未來所有新客戶都不用再手動加測試人員，直接在 LINE 裡按一下就能授權自己的 Threads 帳號！

> **出發前確認兩件事（由總經理部署完成後進行）**：
> 1. 確認以下 2 個合規專頁已上線可開啟（HTTP 200）：
>    - `https://anangeo.com/privacy/`
>    - `https://anangeo.com/data-deletion/`
> 2. 確認 `relay.anangeo.com` 已完成最新後端部署（含自動取消授權與資料刪除回呼端點）。
> 3. **順手開通免費信箱轉寄（1 分鐘）**：到 Cloudflare 後台 → 選擇網域 `anangeo.com` → 左側 **Email → Email Routing** → 把 `privacy@anangeo.com` 免費轉寄到阿男平常收信的信箱，這樣既能收 Meta 審查信、又不必把私人信箱公開在網頁上。

---

## 一、網址總表（直接照欄位複製貼上）

打開 **Meta for Developers**（`https://developers.facebook.com/apps/`）點進我們的應用程式（`Anan Social Relay`），到對應頁面把下面網址逐條貼上：

### 1. 左側選單：應用程式設定 → 基本資料（App Settings → Basic）

| 後台欄位名稱 | 直接複製貼上這條網址 |
|---|---|
| **應用程式網域（App Domains）** | `anangeo.com`、`relay.anangeo.com` |
| **隱私權政策網址（Privacy Policy URL）** | `https://anangeo.com/privacy/` |
| **用戶資料刪除（User Data Deletion）→ 選「資料刪除回呼網址」** | `https://relay.anangeo.com/oauth/threads/data-deletion` |
| *(備選：若該處欄位要求填說明頁網址 / Data Deletion Instructions URL)* | `https://anangeo.com/data-deletion/` |
| **聯絡電子郵件（Contact Email）** | `privacy@anangeo.com` |

> 填完記得按右下角 **儲存變更（Save changes）**。

### 2. 左側選單：使用案例 → Threads API → 自訂 → 設定（Use cases → Threads API → Settings）

| 後台欄位名稱 | 直接複製貼上這條網址 |
|---|---|
| **重新導向回呼網址（Redirect Callback URLs）** | `https://relay.anangeo.com/oauth/threads/callback` |
| **解除安裝／取消授權回呼網址（Uninstall / Deauthorize Callback URL）** | `https://relay.anangeo.com/oauth/threads/deauthorize` |
| **資料刪除要求回呼網址（Delete / Data Deletion Callback URL）** | `https://relay.anangeo.com/oauth/threads/data-deletion` |

> 貼完後按 **儲存（Save）**。如果欄位提示要按驗證，確認網址開頭都是 `https://` 且沒有多餘空格。

---

## 二、權限審查表單：英文說明範本（直接整段複製貼上）

左側選單進 **應用程式審查 → 權限和功能（App Review → Permissions and Features）**，將以下兩個權限加入審查清單並直接複製對應英文說明：

### 1. `threads_basic` 審查說明（整段複製）

```text
Our application (Anan Social Relay, operated by Anan GEO Workshop at https://anangeo.com) helps small local business owners publish store updates from their LINE Official Account directly to their own business website and Threads profile.

We request `threads_basic` solely to identify the store owner's Threads User ID and basic public profile after the owner explicitly completes the Meta Threads OAuth consent flow. We store the Threads User ID strictly to bind the authorized Threads account to the merchant's isolated store workspace so posts are always routed to the correct account, and to match automated Deauthorize / Data Deletion callbacks if the owner later removes our app.

We never scrape follower lists, read private messages, sell user data, or use any data for external model training.
```

### 2. `threads_content_publish` 審查說明（整段複製）

```text
We request `threads_content_publish` so verified local business owners can publish their own store announcements (text and promotional images) to their own Threads account after reviewing and explicitly approving each post.

End-to-end user flow:
1. A store owner connects their store in our LINE Official Account and taps the Threads authorization button, completing Meta's official OAuth screen.
2. When the owner sends a new announcement photo or text in LINE, our assistant generates an interactive preview card showing the exact post text and image.
3. Nothing is ever posted automatically without confirmation. Only after the owner taps the "Confirm & Publish" button in LINE does our server call the Threads Graph API (`threads_content_publish`) to publish that single approved post to the owner's Threads account and sync it to their store website.
4. Store owners can revoke access anytime in the Threads app (Settings -> Account -> Website permissions -> Remove) or by sending `解除綁定Threads` in LINE, and can view full deletion instructions at https://anangeo.com/data-deletion/.
```

### 3. 給審查員的測試操作說明（Test Instructions，整段複製）

```text
How our app works (demonstrated in the attached screencast):
1. Visit https://anangeo.com/privacy/ and https://anangeo.com/data-deletion/ to verify our public bilingual Privacy Policy and Data Deletion Instructions.
2. In the attached screen recording, a merchant initiates onboarding in our LINE Official Account (@954pwtpz), taps the signed Threads OAuth link (https://relay.anangeo.com/oauth/threads/start), and grants `threads_basic` and `threads_content_publish` on Meta's official Threads login screen.
3. After OAuth callback (https://relay.anangeo.com/oauth/threads/callback), the merchant receives a confirmation message in LINE.
4. The merchant sends a sample store update (text + image) in LINE, inspects the preview card, and taps "Confirm & Publish".
5. The post immediately appears live on the merchant's authorized Threads profile.
6. Finally, the recording demonstrates revoking access / triggering data deletion so the stored token is cleared immediately.
```

---

## 三、錄製 1 分鐘操作影片（手機螢幕錄影即可）

Meta 審查 `threads_content_publish` 時一定要附一段 **30～60 秒無聲音也行的螢幕錄影（MP4）**，阿男用 iPhone／Mac 螢幕錄影照順序錄一次就好：

1. 打開 LINE 機器人，點開「授權 Threads」按鈕。
2. 畫面跳轉到 Meta Threads 官方登入與同意視窗（清楚拍到 `threads_basic` 與 `threads_content_publish` 勾選畫面），按 **允許（Allow）**。
3. 跳回成功頁面並回到 LINE，隨便傳一張店面照片＋兩行測試文字。
4. 機器人回傳預覽確認卡 → 點擊 **確認上架**。
5. 切到 Threads App 往下拉重新整理，拍到剛剛發出去的那篇貼文已出現在帳號上。
6. *(加分畫面)* 切到 Threads App **設定 → 帳號 → 網站權限** 展示可以隨時一鍵移除。

---

## 四、送出審查與切換正式上線（Live Mode）

1. 在 **應用程式審查 → 要求（App Review → Requests）** 上傳剛錄好的 MP4 影片，確認上述英文說明已填妥。
2. 確認左側 **商業驗證（Business Verification）** 若有提示需驗證，照畫面補齊資料；一般 Threads API 個人／小商家開發者帳號送審後約 **1～5 個工作天** 收到核准通知。
3. 收到核准信後，回到 Meta 開發者後台最上方，將應用程式模式開關從 **開發中（Development）** 切換為 **正式上線（Live Mode）**。
4. 切換完成後，請妹妹直接從 LINE 點擊授權按鈕實測一次——不用再手動加測試人員，所有未來客戶皆可自助完成全套綁定！

---

## 五、常用聯絡與合規端點速查

- **隱私權政策專頁**：`https://anangeo.com/privacy/`
- **資料刪除說明專頁**：`https://anangeo.com/data-deletion/`
- **OAuth 授權回呼**：`https://relay.anangeo.com/oauth/threads/callback`
- **取消授權回呼**：`https://relay.anangeo.com/oauth/threads/deauthorize`
- **資料刪除回呼**：`https://relay.anangeo.com/oauth/threads/data-deletion`
- **刪除狀態查詢頁**：`https://relay.anangeo.com/oauth/threads/deletion-status?code=<confirmation_code>`
- **官方 LINE 窗口**：`@954pwtpz`（`https://line.me/R/ti/p/@954pwtpz`）
- **隱私專責信箱**：`privacy@anangeo.com`
