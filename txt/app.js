import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

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
const storage = getStorage(app);
const postList = document.getElementById('post-list');

// ── 圖片預覽狀態 ──
let pendingImages = []; // { file, objectURL }

// 圖片選擇（按鈕 or 貼上）
function addImageFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
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

// 圖片按鈕選擇
document.getElementById('image-btn').addEventListener('click', () => {
    document.getElementById('image-input').click();
});
document.getElementById('image-input').addEventListener('change', (e) => {
    Array.from(e.target.files).forEach(addImageFile);
    e.target.value = '';
});

// 貼上圖片（Ctrl+V / 長按貼上）
document.getElementById('post-input').addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
        if (item.type.startsWith('image/')) {
            addImageFile(item.getAsFile());
        }
    }
});

// 拖放圖片
const postBox = document.querySelector('.post-box');
postBox.addEventListener('dragover', (e) => {
    e.preventDefault();
    postBox.classList.add('drag-over');
});
postBox.addEventListener('dragleave', () => postBox.classList.remove('drag-over'));
postBox.addEventListener('drop', (e) => {
    e.preventDefault();
    postBox.classList.remove('drag-over');
    Array.from(e.dataTransfer.files).forEach(addImageFile);
});

// ── 上傳圖片到 Storage ──
async function uploadImages(files) {
    const urls = [];
    for (const file of files) {
        const storageRef = ref(storage, `images/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        urls.push(url);
    }
    return urls;
}

// ── 1. 發佈貼文邏輯 ──
document.getElementById('submit-btn').addEventListener('click', async () => {
    const content = document.getElementById('post-input').value;
    if (!content.trim() && pendingImages.length === 0) return;

    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = '上傳中...';

    const tagRegex = /#([^\s#]+)/g;
    const matches = content.match(tagRegex) || [];
    const tags = matches.map(tag => tag.substring(1));

    try {
        // 上傳圖片
        const imageFiles = pendingImages.map(p => p.file);
        const imageUrls = imageFiles.length > 0 ? await uploadImages(imageFiles) : [];

        await addDoc(collection(db, "posts"), {
            content,
            tags,
            imageUrls,
            createdAt: serverTimestamp()
        });

        document.getElementById('post-input').value = '';
        // 清除預覽
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

// ── 2. 監聽與渲染貼文 ──
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
        snapshot.forEach((doc) => renderPost(doc.data()));
    });
}

function renderPost(data) {
    const card = document.createElement('div');
    card.className = 'post-card';

    let htmlContent = (data.content || '').replace(/#([^\s#]+)/g, '<span class="tag-link" onclick="filterByTag(\'$1\')">#$1</span>');

    // 圖片區塊
    let imagesHtml = '';
    if (data.imageUrls && data.imageUrls.length > 0) {
        const imgs = data.imageUrls.map(url =>
            `<a href="${url}" target="_blank"><img src="${url}" class="post-image" loading="lazy" /></a>`
        ).join('');
        imagesHtml = `<div class="post-images">${imgs}</div>`;
    }

    card.innerHTML = `
        <div class="post-content">${htmlContent}</div>
        ${imagesHtml}
        <small style="color:#999">${data.createdAt?.toDate().toLocaleString() || '傳送中...'}</small>
    `;
    postList.appendChild(card);
}

// ── 3. 搜尋邏輯 ──
document.getElementById('search-btn').addEventListener('click', () => {
    const tag = document.getElementById('search-input').value.replace('#', '').trim();
    tag ? window.filterByTag(tag) : window.clearFilter();
});

document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('search-btn').click();
});

window.filterByTag = (tag) => loadPosts(tag);
window.clearFilter = () => loadPosts();

loadPosts();
