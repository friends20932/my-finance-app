/**
 * Premium Finance Tracker - Google Sheets 雲端同步後端腳本
 * 
 * 【部署教學】
 * 1. 在 Google 雲端硬碟建立一個新的「Google 試算表」。
 * 2. 點擊頂部選單的「擴充功能」 > 「Apps Script」。
 * 3. 刪除編輯器內原有的程式碼，將此檔案的「所有內容」貼上。
 * 4. 點擊右上角「部署」 > 「新增部署作業」。
 * 5. 類型選擇「網頁應用程式 (Web App)」。
 * 6. 「執行身分」選擇「我 (您的信箱)」。
 * 7. 「誰可以存取」選擇「所有人 (Anyone)」。 (不用擔心，這是一串很長且隨機的 URL，只有您知道)
 * 8. 點擊「部署」，並授予必要的權限。
 * 9. 複製最後產生出來的「網頁應用程式網址 (Web App URL)」。
 * 10. 回到您的記帳 App 中貼上這串網址即可完成同步設定！
 */

// 定義我們要存取資料的儲存格位置
const DATA_CELL = "A1";

// 處理 GET 請求：當前端 App 需要「下載」資料時會呼叫此函式
function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getRange(DATA_CELL).getValue();
  
  // 如果是空的，回傳空的 JSON 物件
  const responseData = data ? data : "{}";
  
  return ContentService.createTextOutput(responseData)
    .setMimeType(ContentService.MimeType.JSON);
}

// 處理 POST 請求：當前端 App 需要「上傳/備份」資料時會呼叫此函式
function doPost(e) {
  try {
    // 取得前端傳過來的 JSON 字串
    const jsonData = e.postData.contents;
    
    // 將 JSON 字串寫入指定的儲存格中
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.getRange(DATA_CELL).setValue(jsonData);
    
    // 同時在 B 欄位記錄最後更新時間，方便您除錯
    sheet.getRange("B1").setValue("最後同步時間：");
    sheet.getRange("C1").setValue(new Date());
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "資料同步成功" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 處理 OPTIONS 請求 (CORS 跨來源資源共用設定)
function doOptions(e) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders(headers);
}
