
//3. app.js (邏輯)
//這是核心檔案，負責處理標籤提取與 Firestore 互動。
//開發重點說明
//標籤提取技術：我們在儲存到 Firestore 前，先用 content.match(/#([^\s#]+)/g) 將所有標籤存入一個名為 tags 的 Array 欄位。這樣才能使用 Firestore 高效的 array-contains 查詢。
//即時更新 (Real-time)：使用 onSnapshot 而不是 getDocs。這能讓網站在不重新整理的情況下，當有人發文時自動跳出新內容，與 LINE 的體驗一致。
//安全性規則：在生產環境中，請務必在 Firebase Console 設定規則，限制只有認證使用者可以寫入資料。
//// 新增一個函式來抓取網址

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
document.getElementById('submit-btn').addEventListener('click', async () => {
    const content = document.getElementById('post-input').value;
    if (!content.trim()) return;

    // 提取標籤 (Regex: 抓取 # 開頭的非空字元)
    const tagRegex = /#([^\s#]+)/g;
    const matches = content.match(tagRegex) || [];
    const tags = matches.map(tag => tag.substring(1)); // 移除 #

    try {
        await addDoc(collection(db, "posts"), {
            content,
            tags,
            createdAt: serverTimestamp()
        });
        document.getElementById('post-input').value = '';
    } catch (e) {
        alert("發佈失敗: " + e.message);
    }
});

// 2. 監聽與渲染貼文
let currentUnsubscribe = null;

// 新增一個函式來抓取網址預覽
async function getLinkPreview(url) {
    // 這裡使用 linkpreview.net 作為範例 (需先去官網申請免費 API Key)
    const apiKey = 'b8bd272ba6179d524d93939132b959ba'; 
    const response = await fetch(`https://api.linkpreview.net/?key=${apiKey}&q=${url}`);
    if (response.ok) {
        return await response.json();
    }
    return null;
}

// 修改原本的 renderPost 函式
async function renderPost(data) {
    const card = document.createElement('div');
    card.className = 'post-card';
    
    // 1. 處理文字與標籤
    let htmlContent = data.content.replace(/#([^\s#]+)/g, '<span class="tag-link" onclick="filterByTag(\'$1\')">#$1</span>');
    
    // 2. 偵測網址 (簡單的網址正則)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = data.content.match(urlRegex);

    card.innerHTML = `
        <div class="post-content">${htmlContent}</div>
        <div class="preview-container" id="preview-${data.id}"></div>
        <small style="color:#999">${data.createdAt?.toDate().toLocaleString() || '傳送中...'}</small>
    `;
    postList.appendChild(card);

    // 3. 如果有網址，非同步抓取預覽圖
    if (urls && urls.length > 0) {
        const previewData = await getLinkPreview(urls[0]); // 抓第一個網址
        if (previewData) {
            const container = document.getElementById(`preview-${data.id}`);
            container.innerHTML = `
                <a href="${previewData.url}" target="_blank" class="link-preview">
                    <img src="${previewData.image}" alt="preview">
                    <div class="link-info">
                        <strong>${previewData.title}</strong>
                        <p>${previewData.description}</p>
                    </div>
                </a>
            `;
        }
    }
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