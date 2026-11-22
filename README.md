# v5.3.1｜首頁新增 2 個外部連結（2026-11-22）

本包以本對話的 **v5.3 定稿位置正式包**為基底（未採用 v5.4／v5.5）。
首頁目前有 11 張卡片：前九張完全沿用原順序及色碼；最後兩張為「3D 人體」「3D 細胞」，採淺灰色、開啟原作者網站新分頁，**不加入離線教材**。依先前視覺決定，首頁只保留蝴蝶、移除海龜顯示。
離線建置來源仍是原本 12 個教材；其他安裝、下載、子選單程式均保持原樣。

> 下方為舊版本的建置背景說明，若版本資訊衝突，以上方 v5.3.1 說明為準。

---

# 剛剛の數位小教室｜Bio-Class v5.2.2 修復包

這份檔案是專門對應你的實際 GitHub 儲存庫：`pipipopo7410/Bio-Class`。

## 這次修正

- 保留你定稿的首頁、9 主題、12 網站連結、蝴蝶與海龜 Logo、App Icon。
- `refresh.html` 會依目前網址判斷網站作用範圍，不再硬寫 `/biology-hub/`。
- `sw.js` 只讀取本版入口網站快取，避免誤讀其他舊版快取；舊的入口網站快取會清除，但**不會主動刪除 `gg-module-v1-*` 已下載教材快取與 `gg-room-offline-meta-v1`**。
- `scripts/build_offline.py` 自動使用現在儲存庫名稱，且本機預設為 `Bio-Class`。
- `home-button.js` 中示範的返回首頁目標改為 `Bio-Class`。

## 上傳（重要）

1. 前往 `https://github.com/pipipopo7410/Bio-Class`，先備份現有版本。
2. 解壓縮本 ZIP，**上傳其中的檔案與資料夾，不是 ZIP 本身**。所有檔案都要放在儲存庫根目錄。
3. 尤其確認以下三個資料夾存在：
   - `.github/workflows/build-offline.yml`（隱藏資料夾，容易漏傳）
   - `scripts/build_offline.py` 與 `scripts/sources.json`
   - `assets/` 中的圖片與圖示
4. GitHub → Actions，理應看到 `Build offline classroom` 工作流程。手動執行一次，確認兩個工作 Job 都綠色。
5. 開啟 `https://pipipopo7410.github.io/Bio-Class/refresh.html`，點更新按鈕。
6. 再開 `https://pipipopo7410.github.io/Bio-Class/`，檢查新版標題、Logo。

## 先做無痕測試，排除網站網址不一致

開新無痕視窗，直接輸入 `https://pipipopo7410.github.io/Bio-Class/`。如果這裡顯示新版，但你原本瀏覽器畫面是舊版，應優先用 refresh.html 處理快取。

## 安全提醒

- 完整離線操作尚未經過全部 12 個教材的 iPad 斷網驗收。
- 不要使用「清除所有網站資料」當作第一步，因為可能清掉其他網頁的學習紀錄和已下載教材。
- 如 GitHub Actions 顯示紅色叉叉，停止反覆上傳，改看 Actions 的錯誤訊息。
