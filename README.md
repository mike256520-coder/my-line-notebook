# my-line-notebook
https://mike256520-coder.github.io/my-line-notebook/

#重點說明

標籤提取技術：我們在儲存到 Firestore 前，先用 content.match(/#([^\s#]+)/g) 將所有標籤存入一個名為 tags 的 Array 欄位。
這樣才能使用 Firestore 高效的 array-contains 查詢。

即時更新 (Real-time)：使用 onSnapshot 而不是 getDocs。這能讓網站在不重新整理的情況下，當有人發文時自動跳出新內容，與 LINE 的體驗一致。
