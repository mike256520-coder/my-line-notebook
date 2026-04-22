
//3. app.js (邏輯)
//這是核心檔案，負責處理標籤提取與 Firestore 互動。
//開發重點說明
//標籤提取技術：我們在儲存到 Firestore 前，先用 content.match(/#([^\s#]+)/g) 將所有標籤存入一個名為 tags 的 Array 欄位。這樣才能使用 Firestore 高效的 array-contains 查詢。
//即時更新 (Real-time)：使用 onSnapshot 而不是 getDocs。這能讓網站在不重新整理的情況下，當有人發文時自動跳出新內容，與 LINE 的體驗一致。
//安全性規則：在生產環境中，請務必在 Firebase Console 設定規則，限制只有認證使用者可以寫入資料。
//

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// TODO: 替換成你的 Firebase Config
//apiKey: "AIzaSyACO9osKdxj8x2-fAwxgUM0YA_zM2uCWwU",
  //  authDomain: "line-note-9be19.firebaseapp.com",
   //projectId: "line-note-9be19",
    //storageBucket: "line-note-9be19.firebasestorage.app",
   //// messagingSenderId: "186753935423",
   // appId: "1:186753935423:web:62a5d9cdf6a66eb8a2f08a",
    //measurementId: "G-79656JSS59"
const firebaseConfig = {
    apiKey: "AIzaSyACO9osKdxj8x2-fAwxgUM0YA_zM2uCWwU",
    authDomain: "line-note-9be19.firebaseapp.com",
    projectId: "line-note-9be19",
    storageBucket: "line-note-9be19.firebasestorage.app",
    messagingSenderId: "186753935423",
    appId: "1:186753935423:web:62a5d9cdf6a66eb8a2f08a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const postList = document.getElementById('post-list');

// 1. 發佈貼文邏輯
//原來的:  document.getElementById('submit-btn').addEventListener('click', async () => {
   // 在發佈按鈕的事件監聽器中修改
   //(修改「發佈貼文」邏輯:在資料寫入 Firestore 之前，先完成網址偵測與預覽資訊的抓取。)
document.getElementById('submit-btn').addEventListener('click', async () => {
    const content = document.getElementById('post-input').value;
    if (!content.trim()) return;

    // A. 提取標籤 (原本的邏輯)
    const tagRegex = /#([^\s#]+)/g;
    const matches = content.match(tagRegex) || [];
    const tags = matches.map(tag => tag.substring(1).toLowerCase());

    // B. 偵測並抓取網址預覽 (新增的邏輯)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = content.match(urlRegex);
    let linkPreviewData = null;

    if (urls && urls.length > 0) {
        // 抓取第一個網址的預覽
        linkPreviewData = await getLinkPreview(urls[0]);
    }

    try {
        // C. 將所有資訊一併存入 Firestore
        await addDoc(collection(db, "posts"), {
            content: content,
            tags: tags,
            linkPreview: linkPreviewData, // 這裡是重點：直接存入 Object
            createdAt: serverTimestamp()
        });
        document.getElementById('post-input').value = '';
    } catch (e) {
        console.error("發佈失敗", e);
    }
});

// 2. 監聽與渲染貼文
let currentUnsubscribe = null;

function loadPosts(filterTag = null) {
    if (currentUnsubscribe) currentUnsubscribe();

    let q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    
    if (filterTag) {
        q = query(collection(db, "posts"), 
                  where("tags", "array-contains", filterTag),
                  orderBy("createdAt", "desc"));
        document.getElementById('active-filter').classList.remove('hidden');
        document.getElementById('current-tag').innerText = filterTag;
    } else {
        document.getElementById('active-filter').classList.add('hidden');
    }

    currentUnsubscribe = onSnapshot(q, (snapshot) => {
        postList.innerHTML = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            renderPost(data);
        });
    });
}




 // 新增一個函式來抓取網址預覽
async function getLinkPreview(url) {
    // 這裡使用 linkpreview.net 作為範例 (需先去官網申請免費 API Key  b8bd272ba6179d524d93939132b959ba)
    const apiKey = 'b8bd272ba6179d524d93939132b959ba'; 
    const response = await fetch(`https://api.linkpreview.net/?key=${apiKey}&q=${url}`);
    if (response.ok) {
        return await response.json();
    }
    return null;
}

//原來的:  function renderPost(data) {.....    
// 修改原本的 renderPost 函式
//修改「渲染貼文」邏輯
//再改-現在不需要再從瀏覽器呼叫外部 API 了，直接從資料庫讀取欄位...錯誤處理： 在 getLinkPreview 函式中，建議加上 try...catch。如果某個網址 API 抓不到（例如私密連結），就回傳 null，確保貼文依然能正常發佈。

//圖片失效問題： 有些網站的圖片網址有時效性（例如 FB 或一些有防盜鏈的網站）。如果你希望圖片永久保存，進階做法是先將圖片下載下來，存入 Firebase Storage，然後在 linkPreview.image 存入你自己的 Storage URL。

function renderPost(data) {
    const card = document.createElement('div');
    card.className = 'post-card';
    
    // 處理文字與標籤連結
    let htmlContent = data.content.replace(/#([^\s#]+)/g, 
        '<span class="tag-link" onclick="filterByTag(\'$1\')">#$1</span>');
    
    // 檢查是否有預先存好的預覽資訊
    let previewHtml = '';
    if (data.linkPreview) {
        const lp = data.linkPreview;
        previewHtml = `
            <a href="${lp.url}" target="_blank" class="link-preview">
                ${lp.image ? `<img src="${lp.image}" alt="preview">` : ''}
                <div class="link-info">
                    <strong>${lp.title || '無標題'}</strong>
                    <p>${lp.description || ''}</p>
                </div>
            </a>
        `;
    }

    card.innerHTML = `
        <div class="post-content">${htmlContent}</div>
        ${previewHtml}
        <small style="color:#999">${data.createdAt?.toDate().toLocaleString() || '傳送中...'}</small>
    `;
    postList.appendChild(card);
}


// ... 前面的程式碼 ...

// 3. 搜尋按鈕邏輯
document.getElementById('search-btn').addEventListener('click', () => {
    const searchInput = document.getElementById('search-input');
    // 自動去掉使用者可能輸入的 # 號，並修剪空白
    const tag = searchInput.value.replace('#', '').trim();
    
    if (tag) {
        window.filterByTag(tag);
    } else {
        window.clearFilter(); // 如果搜尋框是空的，就顯示全部
    }
});

// 支援按下 Enter 鍵搜尋
document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('search-btn').click();
    }
});

// ... 後面的載入邏輯 ...


// 暴露給 HTML 使用的全局函數
window.filterByTag = (tag) => loadPosts(tag);
window.clearFilter = () => loadPosts();

// 初始載入
loadPosts();