//*// 找到 app.js 最末端，將 loadPosts() 改為：
// 這樣一進到這個網頁，就只會抓取帶有 #吉他 標籤的內容...loadPosts('吉他');
//*3. app.js (邏輯)
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

function renderPost(data) {
    const card = document.createElement('div');
    card.className = 'post-card';
    
    // 將內容中的標籤轉換為可點擊連結
    let htmlContent = data.content.replace(/#([^\s#]+)/g, '<span class="tag-link" onclick="filterByTag(\'$1\')">#$1</span>');
    
    card.innerHTML = `
        <div class="post-content">${htmlContent}</div>
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
//舊的loadPosts();
loadPosts('吉他');