// ═══════════20260513═圖文/按圖/分頁版═════════════════════
// damie / ANE0N-LZ7HA-9Y4IT-DBKA3-K7NIQ
// ══════https://claude.ai/share/aa53b308-a308-4ad6-bfc1-33ad22c00f23══════════════════════════════════
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
const PAGE_SIZE = 20; // 每頁幾筆

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
// ── 抓取網址預覽 ──
// ════════════════════════════════════════
async function getLinkPreview(url) {
    const apiKey = 'b8bd272ba6179d524d93939132b959ba';
    try {
        const response = await fetch(`https://api.linkpreview.net/?key=${apiKey}&q=${url}`);
        if (response.ok) return await response.json();
    } catch (e) { console.warn("預覽抓取失敗", e); }
    return null;
}

// ════════════════════════════════════════
// ── 1. 發佈貼文 ──
// ════════════════════════════════════════
document.getElementById('submit-btn').addEventListener('click', async () => {
    const content = document.getElementById('post-input').value;
    if (!content.trim() && pendingImages.length === 0) return;

    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    const tags = content.match(/#([^\s#]+)/g)?.map(t => t.slice(1)) || [];

    try {
        let previewData = null;
        const urls = content.match(/(https?:\/\/[^\s]+)/g);
        if (urls?.length > 0) {
            btn.textContent = '抓取預覽中...';
            previewData = await getLinkPreview(urls[0]);
        }

        btn.textContent = '壓縮圖片中...';
        const imageBase64s = await Promise.all(pendingImages.map(p => compressImageToBase64(p.file)));

        btn.textContent = '儲存中...';
        await addDoc(collection(db, "posts"), {
            content, tags, linkPreview: previewData, imageBase64s,
            createdAt: serverTimestamp()
        });

        document.getElementById('post-input').value = '';
        pendingImages.forEach(p => URL.revokeObjectURL(p.objectURL));
        pendingImages = [];
        renderImagePreviews();

        // 發佈後重新從頭載入（只載第一頁）
        resetAndLoad();

    } catch (e) {
        alert("發佈失敗: " + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '送出(稍待截圖)';
    }
});

// ════════════════════════════════════════
// ── 2. 分頁載入貼文（取代 onSnapshot）──
// ════════════════════════════════════════
let currentFilter = null;
let lastDoc = null;       // 分頁游標
let isLoading = false;
let hasMore = true;
let currentUnsubscribe = null; // 只用於監聽最新一筆

function buildQuery(afterDoc = null) {
    let q;
    if (currentFilter) {
        q = query(collection(db, "posts"),
            where("tags", "array-contains", currentFilter),
            orderBy("createdAt", "desc"),
            limit(PAGE_SIZE));
    } else {
        q = query(collection(db, "posts"),
            orderBy("createdAt", "desc"),
            limit(PAGE_SIZE));
    }
    if (afterDoc) q = query(collection(db, "posts"),
        ...(currentFilter ? [where("tags", "array-contains", currentFilter)] : []),
        orderBy("createdAt", "desc"),
        startAfter(afterDoc),
        limit(PAGE_SIZE));
    return q;
}

// 重設並從頭載入
function resetAndLoad(filterTag = currentFilter) {
    currentFilter = filterTag;
    lastDoc = null;
    hasMore = true;
    postList.innerHTML = '';
    removeLoadMoreBtn();

    // 取消舊的即時監聽
    if (currentUnsubscribe) { currentUnsubscribe(); currentUnsubscribe = null; }

    // 用 onSnapshot 只監聽第一頁（偵測新貼文）
    const q = buildQuery();
    currentUnsubscribe = onSnapshot(q, (snapshot) => {
        // 只在第一次或有新增時重繪第一頁
        if (lastDoc === null) {
            postList.innerHTML = '';
            snapshot.forEach(doc => renderPost(doc.data()));
            if (snapshot.docs.length > 0) lastDoc = snapshot.docs[snapshot.docs.length - 1];
            hasMore = snapshot.docs.length === PAGE_SIZE;
            if (hasMore) addLoadMoreBtn();
        } else {
            // 有新貼文插到最前面
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added' && change.newIndex === 0) {
                    const card = buildCard(change.doc.data());
                    postList.insertBefore(card, postList.firstChild);
                }
            });
        }
    });

    // 更新搜尋 UI
    if (filterTag) {
        document.getElementById('active-filter').classList.remove('hidden');
        document.getElementById('current-tag').innerText = filterTag;
    } else {
        document.getElementById('active-filter').classList.add('hidden');
    }
}

// 載入更多（第二頁之後用 getDocs，不用即時監聽）
async function loadMore() {
    if (isLoading || !hasMore) return;
    isLoading = true;
    const btn = document.getElementById('load-more-btn');
    if (btn) btn.textContent = '載入中...';

    const q = buildQuery(lastDoc);
    const snapshot = await getDocs(q);

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
function buildCard(data) {
    const card = document.createElement('div');
    card.className = 'post-card';

    let htmlContent = (data.content || '').replace(
        /#([^\s#]+)/g,
        '<span class="tag-link" onclick="filterByTag(\'$1\')">#$1</span>'
    );

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
            </a>`;
    }

    let imagesHtml = '';
    if (data.imageBase64s?.length > 0) {
        // 用 data-src 延遲載入，不直接塞 src
        const imgs = data.imageBase64s.map((b64, i) =>
            `<img data-src="${b64}" class="post-image lazy" loading="lazy" style="cursor:pointer;background:#eee;min-height:80px" data-index="${i}">`
        ).join('');
        imagesHtml = `<div class="post-images">${imgs}</div>`;
    }

    card.innerHTML = `
        <div class="post-content">${htmlContent}</div>
        ${previewHtml}
        ${imagesHtml}
        <small style="color:#999">${data.createdAt?.toDate().toLocaleString() || '傳送中...'}</small>
    `;

    // 圖片點擊開新頁
    card.querySelectorAll('.post-image').forEach((img, i) => {
        img.addEventListener('click', () => {
            const b64 = data.imageBase64s[i];
            const byteStr = atob(b64.split(',')[1]);
            const u8 = new Uint8Array(byteStr.length);
            for (let j = 0; j < byteStr.length; j++) u8[j] = byteStr.charCodeAt(j);
            const url = URL.createObjectURL(new Blob([u8], { type: 'image/jpeg' }));
            window.open(url, '_blank');
        });

        // IntersectionObserver 延遲載入圖片
        imgObserver.observe(img);
    });

    return card;
}

function renderPost(data) {
    postList.appendChild(buildCard(data));
}

// IntersectionObserver：圖片進入畫面才把 data-src 搬到 src
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
}, { rootMargin: '200px' }); // 提前 200px 開始載入

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

// 初始載入
resetAndLoad();
