// ... 前方的 Firebase 初始化與圖片處理代碼保持不變 ...

// ── 1. 渲染貼文 (支援舊版網址預覽 + 新版圖片) ──
function renderPost(data) {
    const card = document.createElement('div');
    card.className = 'post-card';
    
    // 標籤轉換
    let htmlContent = (data.content || '').replace(/#([^\s#]+)/g, '<span class="tag-link">#$1</span>');

    // 相容舊資料的網址預覽
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

    // 新版圖片顯示
    let imagesHtml = '';
    if (data.imageBase64s && data.imageBase64s.length > 0) {
        imagesHtml = `<div class="post-images">` + 
            data.imageBase64s.map(b64 => `<img src="${b64}" class="post-image" />`).join('') + 
            `</div>`;
    }

    card.innerHTML = `
        <div class="post-content">${htmlContent}</div>
        ${previewHtml}
        ${imagesHtml}
        <small style="color:#999">${data.createdAt?.toDate().toLocaleString() || '傳送中...'}</small>
    `;
    postList.appendChild(card);
}

// ── 2. 載入邏輯：自動鎖定「吉他」標籤 ──
function loadGuitarNotes() {
    // 這裡我們直接寫死過濾「吉他」，讓這份筆記本專注於吉他內容
    const q = query(
        collection(db, "posts"), 
        where("tags", "array-contains", "吉他"), 
        orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snapshot) => {
        postList.innerHTML = '';
        snapshot.forEach((doc) => renderPost(doc.data()));
    });
}

// 啟動
loadGuitarNotes();
