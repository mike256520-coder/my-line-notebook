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
const postInput = document.getElementById('post-input');

// ── Canvas 壓縮圖片 ──
function compressImageToBase64(file) {
    return new Promise((resolve, reject) => {
        const MAX_SIDE = 800;
        const QUALITY = 0.75;
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
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', QUALITY));
        };
        img.onerror = reject;
        img.src = url;
    });
}

let pendingImages = []; 
const MAX_IMAGES = 3;

function addImageFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    if (pendingImages.length >= MAX_IMAGES) {
        alert(`最多只能貼 ${MAX_IMAGES} 張圖片`);
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

postInput.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    for (const item of items) {
        if (item.type.startsWith('image/')) addImageFile(item.getAsFile());
    }
});

// ── 1. 發佈貼文 (新版：移除 API 呼叫) ──
document.getElementById('submit-btn').addEventListener('click', async () => {
    const content = postInput.value;
    if (!content.trim() && pendingImages.length === 0) return;

    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = '處理中...';

    const tags = content.match(/#([^\s#]+)/g)?.map(tag => tag.substring(1)) || [];

    try {
        const imageBase64s = await Promise.all(pendingImages.map(p => compressImageToBase64(p.file)));

        await addDoc(collection(db, "posts"), {
            content,
            tags,
            imageBase64s,
            createdAt: serverTimestamp()
            // 注意：這裡不再加入 linkPreview 欄位
        });

        // 成功後預填 #吉他
        postInput.value = '#吉他 '; 
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

// ── 2. 渲染貼文 (支援舊有的 linkPreview) ──
function renderPost(data) {
    const card = document.createElement('div');
    card.className = 'post-card';

    // 處理文字與標籤
    let htmlContent = (data.content || '').replace(/#([^\s#]+)/g, '<span class="tag-link" onclick="filterByTag(\'$1\')">#$1</span>');

    // [相容層]：檢查是否有舊版的網址預覽資料
    let previewHtml = '';
    if (data.linkPreview) {
        const lp = data.linkPreview;
        previewHtml = `
            <a href="${lp.url}" target="_blank" class="link-preview">
                ${lp.image ? `<img src="${lp.image}" alt="preview">` : ''}
                <div class="link-info">
                    <strong>${lp.title || '連結預覽'}</strong>
                    <p>${lp.description || ''}</p>
                </div>
            </a>
        `;
    }

    // 處理圖片
    let imagesHtml = '';
    if (data.imageBase64s && data.imageBase64s.length > 0) {
        const imgs = data.imageBase64s.map(b64 =>
            `<a href="${b64}" target="_blank"><img src="${b64}" class="post-image" loading="lazy" /></a>`
        ).join('');
        imagesHtml = `<div class="post-images">${imgs}</div>`;
    }

    card.innerHTML = `
        <div class="post-content">${htmlContent}</div>
        ${previewHtml}
        ${imagesHtml}
        <small style="color:#999">${data.createdAt?.toDate().toLocaleString() || '傳送中...'}</small>
    `;
    postList.appendChild(card);
}

// ── 3. 基礎邏輯 ──
let currentUnsubscribe = null;
function loadPosts(filterTag = null) {
    if (currentUnsubscribe) currentUnsubscribe();
    let q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    if (filterTag) {
        q = query(collection(db, "posts"), where("tags", "array-contains", filterTag), orderBy("createdAt", "desc"));
        document.getElementById('active-filter').classList.remove('hidden');
        document.getElementById('current-tag').innerText = filterTag;
    } else {
        document.getElementById('active-filter').classList.add('hidden');
    }
    currentUnsubscribe = onSnapshot(q, (snapshot) => {
        postList.innerHTML = '';
        snapshot.forEach((doc) => renderPost(doc.data()));
    });
}

document.getElementById('search-btn').addEventListener('click', () => {
    const tag = document.getElementById('search-input').value.replace('#', '').trim();
    tag ? window.filterByTag(tag) : window.clearFilter();
});

window.filterByTag = (tag) => loadPosts(tag);
window.clearFilter = () => loadPosts();

loadPosts('吉他');
