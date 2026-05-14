import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// ════════════════════════════════════════
// ── Canvas 壓縮圖片 → Base64 ──
// ════════════════════════════════════════
function compressImageToBase64(file) {
    return new Promise((resolve, reject) => {
        const MAX_SIDE = 800, QUALITY = 0.75;
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            let { width, height } = img;
            if (width > MAX_SIDE || height > MAX_SIDE) {
                if (width >= height) { height = Math.round(height * MAX_SIDE / width); width = MAX_SIDE; }
                else { width = Math.round(width * MAX_SIDE / height); height = MAX_SIDE; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', QUALITY));
        };
        img.onerror = reject;
        img.src = url;
    });
}

// ════════════════════════════════════════
// ── 圖片預覽狀態 ──
// ════════════════════════════════════════
let pendingImages = [];
const MAX_IMAGES = 3;

function addImageFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    if (pendingImages.length >= MAX_IMAGES) {
        alert(`最多只能貼 ${MAX_IMAGES} 張圖片（Firestore 文件上限 1MB）`);
        return;
    }
    const objectURL = URL.createObjectURL(file);
    pendingImages.push({ file, objectURL });
    renderImagePreviews();
}

function renderImagePreviews() {
    const container = document.getElementById('image-preview-container');
    container.innerHTML = '';
    pendingImages.forEach((item, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'preview-thumb-wrapper';
        wrapper.innerHTML = `
            <img src="${item.objectURL}" class="preview-thumb" />
            <button class="remove-thumb" onclick="window.removeImage(${index})">✕</button>
        `;
        container.appendChild(wrapper);
    });
}

window.removeImage = (index) => {
    URL.revokeObjectURL(pendingImages[index].objectURL);
    pendingImages.splice(index, 1);
    renderImagePreviews();
};

document.getElementById('image-btn').addEventListener('click', () => document.getElementById('image-input').click());
document.getElementById('image-input').addEventListener('change', (e) => {
    Array.from(e.target.files).forEach(addImageFile);
    e.target.value = '';
});
document.getElementById('post-input').addEventListener('paste', (e) => {
    for (const item of e.clipboardData?.items || [])
        if (item.type.startsWith('image/')) addImageFile(item.getAsFile());
});
const postBox = document.querySelector('.post-box');
postBox.addEventListener('dragover', (e) => { e.preventDefault(); postBox.classList.add('drag-over'); });
postBox.addEventListener('dragleave', () => postBox.classList.remove('drag-over'));
postBox.addEventListener('drop', (e) => {
    e.preventDefault(); postBox.classList.remove('drag-over');
    Array.from(e.dataTransfer.files).forEach(addImageFile);
});

// ════════════════════════════════════════
// ── 1. 發佈貼文 ──
// ════════════════════════════════════════
document.getElementById('submit-btn').addEventListener('click', async () => {
    const content = document.getElementById('post-input').value;
    if (!content.trim() && pendingImages.length === 0) return;

    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = '壓縮中...';

    const tags = content.match(/#([^\s#]+)/g)?.map(t => t.slice(1)) || [];

    try {
        const imageBase64s = await Promise.all(pendingImages.map(p => compressImageToBase64(p.file)));
        btn.textContent = '儲存中...';
        await addDoc(collection(db, "posts"), {
            content, tags, imageBase64s,
            createdAt: serverTimestamp()
        });

        document.getElementById('post-input').value = '';
        pendingImages.forEach(p => URL.revokeObjectURL(p.objectURL));
        pendingImages = [];
        renderImagePreviews();
    } catch (e) {
        alert("發佈失敗: " + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '送出';
    }
});

// ════════════════════════════════════════
// ── 2. 監聽與渲染貼文 ──
// 多標籤：用第一個標籤查 Firestore，其餘在前端過濾
// ════════════════════════════════════════
let currentUnsubscribe = null;
let currentTags = []; // 目前篩選的標籤陣列

function loadPosts(filterTags = []) {
    if (currentUnsubscribe) currentUnsubscribe();
    currentTags = filterTags;

    let q = query(collection(db, "posts"), orderBy("createdAt", "desc"));

    if (filterTags.length > 0) {
        // 用第一個標籤讓 Firestore 縮小範圍
        q = query(collection(db, "posts"),
            where("tags", "array-contains", filterTags[0]),
            orderBy("createdAt", "desc"));

        document.getElementById('active-filter').classList.remove('hidden');
        document.getElementById('current-tag').innerText = filterTags.join(' + ');
    } else {
        document.getElementById('active-filter').classList.add('hidden');
    }

    currentUnsubscribe = onSnapshot(q, (snapshot) => {
        postList.innerHTML = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            // 前端再過濾：第2、3個標籤也必須符合
            if (filterTags.length > 1) {
                const postTags = data.tags || [];
                const allMatch = filterTags.every(t => postTags.includes(t));
                if (!allMatch) return;
            }
            renderPost(data);
        });
    });
}

// ════════════════════════════════════════
// ── 3. 渲染貼文 ──
// ════════════════════════════════════════
function renderPost(data) {
    const card = document.createElement('div');
    card.className = 'post-card';

    const htmlContent = (data.content || '').replace(
        /#([^\s#]+)/g,
        '<span class="tag-link" onclick="filterByTag(\'$1\')">#$1</span>'
    );

    let imagesHtml = '';
    if (data.imageBase64s?.length > 0) {
        const imgs = data.imageBase64s.map((b64, i) =>
            `<img src="${b64}" class="post-image" loading="lazy" style="cursor:pointer" data-index="${i}">`
        ).join('');
        imagesHtml = `<div class="post-images">${imgs}</div>`;
    }

    card.innerHTML = `
        <div class="post-content">${htmlContent}</div>
        ${imagesHtml}
        <small style="color:#999">${data.createdAt?.toDate().toLocaleString() || '傳送中...'}</small>
    `;

    card.querySelectorAll('.post-image').forEach((img, i) => {
        img.addEventListener('click', () => {
            const b64 = data.imageBase64s[i];
            const byteStr = atob(b64.split(',')[1]);
            const u8 = new Uint8Array(byteStr.length);
            for (let j = 0; j < byteStr.length; j++) u8[j] = byteStr.charCodeAt(j);
            window.open(URL.createObjectURL(new Blob([u8], { type: 'image/jpeg' })), '_blank');
        });
    });

    postList.appendChild(card);
}

// ════════════════════════════════════════
// ── 4. 搜尋邏輯（支援多標籤）──
// 輸入方式：空格或逗號分隔，例如：吉他 音樂 / #吉他,#音樂
// ════════════════════════════════════════
document.getElementById('search-btn').addEventListener('click', () => {
    const raw = document.getElementById('search-input').value;
    const tags = raw.split(/[\s,，]+/)
                    .map(t => t.replace(/#/g, '').trim())
                    .filter(t => t.length > 0);
    tags.length > 0 ? window.filterByTags(tags) : window.clearFilter();
});

document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('search-btn').click();
});

// 貼文內標籤點擊（單一標籤）
window.filterByTag = (tag) => {
    document.getElementById('search-input').value = tag;
    window.filterByTags([tag]);
};

// 多標籤搜尋
window.filterByTags = (tags) => loadPosts(tags);
window.clearFilter = () => {
    document.getElementById('search-input').value = '';
    loadPosts([]);
};

loadPosts();
