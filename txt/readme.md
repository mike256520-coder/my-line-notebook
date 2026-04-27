主頁放介紹,文字檔放這兒  


# ai新增可附圖
https://claude.ai/share/aa53b308-a308-4ad6-bfc1-33ad22c00f23  
==>注意：把 Storage 要收費拿掉，改成 Canvas 壓縮 → Base64 → 存 Firestore//  
  compressImageToBase64(file) — 用 Canvas 把圖片縮到最長邊 800px、JPEG 品質 0.75，大約每張壓縮後 100~300KB//  
    最多 3 張限制（超過會提示）送出時按鈕顯示「壓縮中...」→「儲存中...」的狀態提示//  
      Firestore 存 imageBase64s 陣列（Base64 字串），讀取時直接當 <img src> 使用//  
      
