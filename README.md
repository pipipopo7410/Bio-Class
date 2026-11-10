# 剛剛數位小教室 — 九宮格入口網站（可擴充版）

## 這一版已完成

- 首頁 9 個大卡片、不同柔和粉彩底色，只有主題大標題與離線狀態。
- 主題名稱已修正為「排氨」。
- 點選後使用同一個 Safari 分頁進入教學工具，Safari「上一頁」返回；**不使用 iframe，也不額外增加頂部工具列**。
- 所有卡片由 `apps.json` 產生；之後新增單元，**不必修改首頁 HTML 或 CSS**。
- 首頁自己使用 Service Worker 快取，網站發佈後可在適當條件下離線開啟首頁。
- 離線狀態不顯示假成功：目前 9 個工具仍在其他獨立 GitHub Pages 專案，會顯示「需連線」。

## GitHub Pages 上線方式（新專案）

1. GitHub 建立新的 **Public** repository，例如 `ganggang-classroom`。
2. 使用 **Add file → Upload files**，將本 ZIP 解壓後的 `index.html`、`app.js`、`style.css`、`apps.json`、`sw.js` 上傳到專案根目錄。（README.md 可一起上傳。）
3. 點擊 **Commit changes**。
4. 進入 **Settings → Pages**，選擇 **Deploy from a branch**；Branch 選 `main`，Folder 選 `/(root)`，按 **Save**。
5. 網址通常為 `https://pipipopo7410.github.io/ganggang-classroom/`（取決於實際專案名稱）；網站發佈完成後再打開。

> 注意：上述九個工具網址是按照公開 repository 名稱推定的 GitHub Pages 路徑，沒有完成逐站連線驗證。如果個別按鈕打不開，請將正確網址改到 `apps.json`。

## 以後新增單元：只改 apps.json

在 `"apps"` 陣列最後一筆後面加上逗號，再貼入：

```json
{
  "id": "respiration",
  "name": "呼吸",
  "url": "https://pipipopo7410.github.io/你的新專案名稱/",
  "offline": {"mode": "external"}
}
```

`id` 不可與現有重複。頁面會自動多一張按鈕，粉彩色依序分配；在固定 3 欄排列下，相鄰不會重複同一色塊。修改後 GitHub Pages 會更新，不用動版面程式碼。

## 離線狀態的真正意義

- **需連線**：工具網址在平台外面，目前首頁無法替它保證離線執行。
- **尚未預載**：已設定成本平台的本地模組，但這台 iPad 的快取檔案不完整。
- **已快取・待驗證**：清單上的檔案已快取，但尚未完成斷網功能實測。
- **離線可用**：本地模組的清單檔案都在快取內，且 `verified` 已在斷網功能實測後設為 `true`。

注意：檔案清單和測試都要完整，iPad Safari 也可能因儲存空間管理清除快取。上課前應在每台 iPad 按「重新檢查」，並抽測關閉 Wi-Fi 的實際操作。

### 將工具搬入本平台後的設定範例

將某工具（假設為 `enzyme`）的 HTML、圖片、JS 與 CSS 全部放進本專案的 `modules/enzyme/`。排除或改成可離線使用的 CDN 外部依賴後，再把該工具的 `apps.json` 設為：

```json
{
  "id": "enzyme",
  "name": "酵素",
  "url": "./modules/enzyme/index.html",
  "offline": {
    "mode": "local",
    "version": "v1",
    "verified": false,
    "files": [
      "./modules/enzyme/index.html",
      "./modules/enzyme/chart.umd.min.js",
      "./modules/enzyme/style.css"
    ]
  }
}
```

`files` 須列出工具運作必需的所有本機資源；**這只是格式範例，不代表目前已有這些檔案**。

當 `apps.json` 設定了 `offline.mode = "local"`，首頁右上方會自動出現「預載工具」按鈕，可下載這些工具清單列出的本機資源；未經完整斷網實測，仍會顯示「已快取・待驗證」。目前的九個外部網站不能由此按鈕跨專案自動下載。

## 教室使用注意

- 首次部署，30 台 iPad 仍需要各自下載首頁及工具資源；建議分批處理。
- 使用 Safari 的正常分頁模式，不建議先把網站安裝為「全螢幕主畫面 App」，因為你希望依靠 Safari 上一頁返回。
- 目前僅首頁可快取；**九個外部工具尚未取得真正離線操作能力**。
- 若直接在電腦雙擊 `index.html`，會出現 9 張預覽卡片；`apps.json` 的新增變更請在 GitHub Pages 網址測試。
