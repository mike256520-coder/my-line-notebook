// ════https://claude.ai/share/aa53b308-a308-4ad6-bfc1-33ad22c00f23════════════════════════════════════
//damie
//ANE0N-LZ7HA-9Y4IT-DBKA3-K7NIQ


import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot,
         serverTimestamp, limit, startAfter, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const PAGE_SIZE = 20;

// ════════════════════════════════════════
// ── Canvas 壓縮圖片 → Base64 ──0.75改0.55
// ════════════════════════════════════════
function compressImageToBase64(file) {
    return new Promise((resolve, reject) => {
        const MAX_SIDE = 800, QUALITY = 0.55;
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
        resetAndLoad();
    } catch (e) {
        alert("發佈失敗: " + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '送出';
    }
});

// ════════════════════════════════════════
// ── 2. 分頁載入 ──
// ════════════════════════════════════════
let currentFilter = null;
let lastDoc = null;
let isLoading = false;
let hasMore = true;
let currentUnsubscribe = null;

function buildQuery(afterDoc = null) {
    const constraints = [orderBy("createdAt", "desc"), limit(PAGE_SIZE)];
    if (currentFilter) constraints.unshift(where("tags", "array-contains", currentFilter));
    if (afterDoc) constraints.push(startAfter(afterDoc));
    return query(collection(db, "posts"), ...constraints);
}

function resetAndLoad(filterTag = currentFilter) {
    currentFilter = filterTag;
    lastDoc = null;
    hasMore = true;
    postList.innerHTML = '';
    removeLoadMoreBtn();
    if (currentUnsubscribe) { currentUnsubscribe(); currentUnsubscribe = null; }

    const q = buildQuery();
    currentUnsubscribe = onSnapshot(q, (snapshot) => {
        if (lastDoc === null) {
            // 第一次載入
            postList.innerHTML = '';
            snapshot.forEach(doc => renderPost(doc.data()));
            if (snapshot.docs.length > 0) lastDoc = snapshot.docs[snapshot.docs.length - 1];
            hasMore = snapshot.docs.length === PAGE_SIZE;
            if (hasMore) addLoadMoreBtn();
        } else {
            // 只插入新增的貼文到最前面
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added' && change.newIndex === 0) {
                    postList.insertBefore(buildCard(change.doc.data()), postList.firstChild);
                }
            });
        }
    });

    if (filterTag) {
        document.getElementById('active-filter').classList.remove('hidden');
        document.getElementById('current-tag').innerText = filterTag;
    } else {
        document.getElementById('active-filter').classList.add('hidden');
    }
}

async function loadMore() {
    if (isLoading || !hasMore) return;
    isLoading = true;
    const btn = document.getElementById('load-more-btn');
    if (btn) btn.textContent = '載入中...';

    const snapshot = await getDocs(buildQuery(lastDoc));
    snapshot.forEach(doc => renderPost(doc.data()));
    if (snapshot.docs.length > 0) lastDoc = snapshot.docs[snapshot.docs.length - 1];
    hasMore = snapshot.docs.length === PAGE_SIZE;

    if (!hasMore) removeLoadMoreBtn();
    else if (btn) btn.textContent = '載入更多';
    isLoading = false;
}

function addLoadMoreBtn() {
    removeLoadMoreBtn();
    const btn = document.createElement('button');
    btn.id = 'load-more-btn';
    btn.textContent = '載入更多';
    btn.onclick = loadMore;
    postList.after(btn);
}

function removeLoadMoreBtn() {
    document.getElementById('load-more-btn')?.remove();
}

// ════════════════════════════════════════
// ── 3. 渲染貼文 ──
// ════════════════════════════════════════

// IntersectionObserver：捲到畫面附近才載入圖片
const imgObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
                img.src = img.dataset.src;
                delete img.dataset.src;
                img.classList.remove('lazy');
            }
            imgObserver.unobserve(img);
        }
    });
}, { rootMargin: '200px' });

function buildCard(data) {
    const card = document.createElement('div');
    card.className = 'post-card';

    const htmlContent = (data.content || '').replace(
        /#([^\s#]+)/g,
        '<span class="tag-link" onclick="filterByTag(\'$1\')">#$1</span>'
    );

    let imagesHtml = '';
    if (data.imageBase64s?.length > 0) {
        const imgs = data.imageBase64s.map((b64, i) =>
            `<img data-src="${b64}" class="post-image lazy" loading="lazy" style="cursor:pointer;background:#eee;min-height:80px" data-index="${i}">`
        ).join('');
        imagesHtml = `<div class="post-images">${imgs}</div>`;
    }

    card.innerHTML = `
        <div class="post-content">${htmlContent}</div>
        ${imagesHtml}
        <small style="color:#999">${data.createdAt?.toDate().toLocaleString() || '傳送中...'}</small>
    `;

    // 圖片：延遲載入 + 點擊開新頁
    card.querySelectorAll('.post-image').forEach((img, i) => {
        img.addEventListener('click', () => {
            const b64 = data.imageBase64s[i];
            const byteStr = atob(b64.split(',')[1]);
            const u8 = new Uint8Array(byteStr.length);
            for (let j = 0; j < byteStr.length; j++) u8[j] = byteStr.charCodeAt(j);
            window.open(URL.createObjectURL(new Blob([u8], { type: 'image/jpeg' })), '_blank');
        });
        imgObserver.observe(img);
    });

    return card;
}

function renderPost(data) {
    postList.appendChild(buildCard(data));
}

// ════════════════════════════════════════
// ── 4. 搜尋邏輯 ──
// ════════════════════════════════════════
document.getElementById('search-btn').addEventListener('click', () => {
    const tag = document.getElementById('search-input').value.replace('#', '').trim();
    tag ? window.filterByTag(tag) : window.clearFilter();
});
document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('search-btn').click();
});

window.filterByTag = (tag) => resetAndLoad(tag);
window.clearFilter = () => resetAndLoad(null);

resetAndLoad();
