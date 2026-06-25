document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements - Navigation Tabs
    const tabSingle = document.getElementById('tab-single');
    const tabBulk = document.getElementById('tab-bulk');
    const singlePanel = document.getElementById('single-panel');
    const bulkPanel = document.getElementById('bulk-panel');

    // DOM Elements - Single Mode
    const shortenForm = document.getElementById('shorten-form');
    const longUrlInput = document.getElementById('long-url');
    const domainSelect = document.getElementById('domain-select');
    const customCodeInput = document.getElementById('custom-code');
    const submitBtn = document.getElementById('submit-btn');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    const btnText = submitBtn.querySelector('span:first-child');
    
    const advancedToggle = document.getElementById('advanced-toggle');
    const advancedSettings = document.querySelector('.advanced-settings');
    const errorMessage = document.getElementById('error-message');
    
    const resultCard = document.getElementById('result-card');
    const shortenedUrlInput = document.getElementById('shortened-url');
    const copyBtn = document.getElementById('copy-btn');
    const visitLink = document.getElementById('visit-link');
    const qrToggleBtn = document.getElementById('qr-toggle-btn');
    const qrContainer = document.getElementById('qr-container');
    const qrCodeImg = document.getElementById('qr-code-img');
    const closeResultBtn = document.getElementById('close-result-btn');

    // DOM Elements - Bulk Mode
    const bulkPasteArea = document.getElementById('bulk-paste-area');
    const btnParseBulk = document.getElementById('btn-parse-bulk');
    const btnClearBulk = document.getElementById('btn-clear-bulk');
    const bulkReviewContainer = document.getElementById('bulk-review-container');
    const bulkReviewList = document.getElementById('bulk-review-list');
    const bulkDomainAll = document.getElementById('bulk-domain-all');
    const btnAddBulkRow = document.getElementById('btn-add-bulk-row');
    const bulkSubmitBtn = document.getElementById('bulk-submit-btn');
    const bulkResultCard = document.getElementById('bulk-result-card');
    const bulkResultList = document.getElementById('bulk-result-list');
    const btnCopyBulkTsv = document.getElementById('btn-copy-bulk-tsv');
    const closeBulkResultBtn = document.getElementById('close-bulk-result-btn');

    // DOM Elements - History Management
    const historyTable = document.getElementById('history-table');
    const historyList = document.getElementById('history-list');
    const emptyState = document.getElementById('empty-state');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const selectAllHistory = document.getElementById('select-all-history');
    const bulkDeleteBar = document.getElementById('bulk-delete-bar');
    const selectedCountVal = document.getElementById('selected-count-val');
    const btnDeleteSelected = document.getElementById('btn-delete-selected');
    const toastContainer = document.getElementById('toast-container');

    // State Variables
    let currentShortUrl = '';
    let bulkResultsData = []; // Stores batch outputs for TSV export

    // Check for global redirect errors
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('error') && urlParams.get('error') === 'notfound') {
        showToast('존재하지 않거나 만료된 단축 링크입니다.', 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // ==========================================
    // 1. Tab Navigation Logic
    // ==========================================
    tabSingle.addEventListener('click', () => {
        tabSingle.classList.add('active');
        tabBulk.classList.remove('active');
        singlePanel.hidden = false;
        bulkPanel.hidden = true;
    });

    tabBulk.addEventListener('click', () => {
        tabBulk.classList.add('active');
        tabSingle.classList.remove('active');
        bulkPanel.hidden = false;
        singlePanel.hidden = true;
    });

    // Toggle Advanced Settings (Single Mode)
    advancedToggle.addEventListener('click', () => {
        advancedSettings.classList.toggle('open');
    });

    // ==========================================
    // 2. Single Shortener Submission
    // ==========================================
    shortenForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const longUrl = longUrlInput.value.trim();
        const customCode = customCodeInput.value.trim();
        const selectedDomain = domainSelect.value;

        // Client-side Validation
        if (!longUrl) {
            showError('URL을 입력해주세요.');
            return;
        }

        if (!isValidUrl(longUrl)) {
            showError('올바른 형식의 URL을 입력해주세요. (http:// 또는 https://로 시작해야 합니다.)');
            return;
        }

        if (customCode && !/^[a-zA-Z0-9_-]{3,20}$/.test(customCode)) {
            showError('고유 단축 코드는 3~20자의 영문, 숫자, 하이픈(-), 언더바(_)만 사용 가능합니다.');
            return;
        }

        hideError();
        setLoading(true);

        try {
            const response = await fetch('/api/shorten', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    url: longUrl, 
                    customCode: customCode || undefined,
                    domain: selectedDomain
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '링크 단축 중 오류가 발생했습니다.');
            }

            // Success
            currentShortUrl = data.shortUrl;
            showResult(data.shortUrl);
            
            // Save to LocalStorage
            saveLocalKey(`${data.domain}:${data.shortCode}`);

            // Refresh history table
            loadHistory();
            
            // Reset Form fields
            longUrlInput.value = '';
            customCodeInput.value = '';
            
            showToast('단축 링크가 성공적으로 생성되었습니다!');
        } catch (error) {
            showError(error.message);
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    });

    // Copy to Clipboard (Single Mode)
    copyBtn.addEventListener('click', () => {
        copyToClipboard(currentShortUrl, '단축 링크가 클립보드에 복사되었습니다!');
    });

    // Close Result Card
    closeResultBtn.addEventListener('click', () => {
        resultCard.hidden = true;
    });

    // Toggle QR Code
    const qrLoader = document.querySelector('.qr-loader');
    qrCodeImg.addEventListener('load', () => {
        if (qrLoader) qrLoader.style.display = 'none';
    });

    qrToggleBtn.addEventListener('click', () => {
        if (qrContainer.hidden) {
            if (qrLoader) qrLoader.style.display = 'block';
            qrCodeImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(currentShortUrl)}`;
            qrContainer.hidden = false;
            qrToggleBtn.querySelector('span:first-child').textContent = 'QR 코드 숨기기';
        } else {
            qrContainer.hidden = true;
            qrToggleBtn.querySelector('span:first-child').textContent = 'QR 코드 보기';
        }
    });

    // ==========================================
    // 3. Bulk Shortener (Excel Import / Grid) Logic
    // ==========================================
    
    // Parse bulk text into review rows
    btnParseBulk.addEventListener('click', () => {
        const rawText = bulkPasteArea.value.trim();
        if (!rawText) {
            showToast('복사한 표 데이터 또는 URL을 입력해주세요.', 'error');
            return;
        }

        const lines = rawText.split('\n');
        const parsedRows = [];

        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return; // Skip empty lines

            // Split by tab (Excel/Google Sheets copy paste) or comma
            let parts = trimmedLine.split('\t');
            if (parts.length === 1) {
                parts = trimmedLine.split(',');
            }

            const url = parts[0].trim();
            const code = parts[1] ? parts[1].trim() : '';
            
            if (url) {
                parsedRows.push({ url, code });
            }
        });

        if (parsedRows.length === 0) {
            showToast('파싱할 수 있는 유효한 URL이 없습니다.', 'error');
            return;
        }

        // Render rows in the review table
        bulkReviewList.innerHTML = '';
        parsedRows.forEach((row, index) => {
            addReviewRow(row.url, row.code, index + 1);
        });

        // Show review section and scroll to it
        bulkReviewContainer.hidden = false;
        bulkReviewContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        showToast(`${parsedRows.length}개의 행이 파싱되었습니다. 검토 후 생성하세요.`);
    });

    // Clear bulk textarea & review
    btnClearBulk.addEventListener('click', () => {
        bulkPasteArea.value = '';
        bulkReviewList.innerHTML = '';
        bulkReviewContainer.hidden = true;
        bulkResultCard.hidden = true;
        showToast('대량 입력 칸이 초기화되었습니다.');
    });

    // Apply domain to all rows
    bulkDomainAll.addEventListener('change', () => {
        const selectedVal = bulkDomainAll.value;
        const rowSelects = bulkReviewList.querySelectorAll('.row-domain-select');
        rowSelects.forEach(select => {
            select.value = selectedVal;
        });
        showToast(`모든 행의 도메인이 ${selectedVal}(으)로 변경되었습니다.`);
    });

    // Add manual row in bulk review list
    btnAddBulkRow.addEventListener('click', () => {
        const nextIndex = bulkReviewList.children.length + 1;
        addReviewRow('', '', nextIndex);
    });

    // Helper to add a review row
    function addReviewRow(url = '', code = '', index = 1) {
        const tr = document.createElement('tr');
        tr.className = 'bulk-review-row';
        
        tr.innerHTML = `
            <td class="row-num text-center" style="font-weight: 600;">${index}</td>
            <td>
                <input type="url" class="row-url-input" value="${escapeHtml(url)}" placeholder="https://example.com/..." required>
            </td>
            <td>
                <select class="row-domain-select">
                    <option value="s.careerup.kr">s.careerup.kr</option>
                    <option value="s.myown.kr">s.myown.kr</option>
                    <option value="s.solcompany.kr">s.solcompany.kr</option>
                </select>
            </td>
            <td>
                <input type="text" class="row-code-input" value="${escapeHtml(code)}" placeholder="custom-code" maxlength="20">
            </td>
            <td class="text-center">
                <button type="button" class="btn-icon delete-row-btn" title="삭제">❌</button>
            </td>
        `;

        // Wire delete button for this row
        tr.querySelector('.delete-row-btn').addEventListener('click', () => {
            tr.remove();
            reindexReviewRows();
        });

        // Set initial domain matching the global dropdown value
        tr.querySelector('.row-domain-select').value = bulkDomainAll.value;

        bulkReviewList.appendChild(tr);
    }

    // Reindex row numbers in bulk review list
    function reindexReviewRows() {
        const rows = bulkReviewList.querySelectorAll('.bulk-review-row');
        rows.forEach((row, i) => {
            row.querySelector('.row-num').textContent = i + 1;
        });
    }

    // Submit Bulk shortener form
    bulkSubmitBtn.addEventListener('click', async () => {
        const rows = bulkReviewList.querySelectorAll('.bulk-review-row');
        if (rows.length === 0) {
            showToast('단축할 링크 행이 없습니다.', 'error');
            return;
        }

        const items = [];
        let hasValidationError = false;

        rows.forEach((row, i) => {
            const urlInput = row.querySelector('.row-url-input');
            const domainSelect = row.querySelector('.row-domain-select');
            const codeInput = row.querySelector('.row-code-input');

            const url = urlInput.value.trim();
            const domain = domainSelect.value;
            const customCode = codeInput.value.trim();

            if (!url) {
                row.style.background = 'rgba(239, 68, 68, 0.1)';
                hasValidationError = true;
            } else {
                row.style.background = '';
                items.push({
                    url,
                    domain,
                    customCode: customCode || undefined
                });
            }
        });

        if (hasValidationError) {
            showToast('필수 값인 원본 URL이 입력되지 않은 행이 있습니다.', 'error');
            return;
        }

        // Show loading state
        bulkSubmitBtn.disabled = true;
        const submitLoader = bulkSubmitBtn.querySelector('.btn-loader');
        const submitText = bulkSubmitBtn.querySelector('span');
        if (submitLoader) submitLoader.hidden = false;
        if (submitText) submitText.style.opacity = '0.5';

        try {
            const response = await fetch('/api/shorten-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '대량 단축 중 오류가 발생했습니다.');
            }

            // Render batch results
            bulkResultsData = data.results;
            renderBulkResults(data.results);

            // Save successes to LocalStorage
            data.results.forEach(res => {
                if (res.success) {
                    saveLocalKey(`${res.domain}:${res.shortCode}`);
                }
            });

            // Clean inputs
            bulkPasteArea.value = '';
            bulkReviewList.innerHTML = '';
            bulkReviewContainer.hidden = true;

            // Refresh history
            loadHistory();
            showToast('대량 단축 링크가 성공적으로 생성되었습니다!');
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            bulkSubmitBtn.disabled = false;
            if (submitLoader) submitLoader.hidden = true;
            if (submitText) submitText.style.opacity = '1';
        }
    });

    // Render bulk output results
    function renderBulkResults(results) {
        bulkResultList.innerHTML = '';
        results.forEach(res => {
            const tr = document.createElement('tr');
            if (res.success) {
                tr.innerHTML = `
                    <td><div class="cell-url-original" title="${escapeHtml(res.originalUrl)}">${escapeHtml(res.originalUrl)}</div></td>
                    <td><a href="${res.shortUrl}" target="_blank" class="cell-url-short">${escapeHtml(res.shortUrl)}</a></td>
                    <td class="text-center"><span class="bulk-result-badge success">성공</span></td>
                `;
            } else {
                tr.innerHTML = `
                    <td><div class="cell-url-original" style="color: var(--text-muted);" title="${escapeHtml(res.originalUrl)}">${escapeHtml(res.originalUrl)}</div></td>
                    <td><span style="color: #f87171; font-size: 0.85rem;">${escapeHtml(res.error)}</span></td>
                    <td class="text-center"><span class="bulk-result-badge fail">실패</span></td>
                `;
            }
            bulkResultList.appendChild(tr);
        });

        bulkResultCard.hidden = false;
        bulkResultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Close Bulk Result Panel
    closeBulkResultBtn.addEventListener('click', () => {
        bulkResultCard.hidden = true;
    });

    // Copy TSV content for pasting back to Excel
    btnCopyBulkTsv.addEventListener('click', () => {
        if (bulkResultsData.length === 0) return;

        let tsvContent = '';
        bulkResultsData.forEach(res => {
            const original = res.originalUrl || '';
            const shortened = res.success ? res.shortUrl : `실패: ${res.error}`;
            tsvContent += `${original}\t${shortened}\n`;
        });

        copyToClipboard(tsvContent, '단축 결과가 엑셀 붙여넣기용(TSV)으로 클립보드에 복사되었습니다! 엑셀에 바로 Ctrl+V 하세요.');
    });


    // ==========================================
    // 4. Link History & Deletion Logic
    // ==========================================

    // Fetch and render the user's history of short links (filtered locally)
    async function loadHistory() {
        try {
            const response = await fetch('/api/history');
            if (!response.ok) throw new Error();
            const data = await response.json();

            // Clear check-all state & reset batch delete bar
            selectAllHistory.checked = false;
            updateBulkDeleteBar();

            const localKeys = getLocalKeys();
            const filteredData = data.filter(item => localKeys.includes(item.dbKey));

            if (filteredData.length === 0) {
                showEmptyState(true);
                return;
            }

            showEmptyState(false);
            historyList.innerHTML = '';

            data.forEach(item => {
                const tr = document.createElement('tr');
                tr.className = 'history-row';
                
                const timeString = formatTime(item.createdAt);
                const displayUrl = item.shortUrl.replace(/^https?:\/\//, '');

                tr.innerHTML = `
                    <td class="text-center">
                        <input type="checkbox" class="history-row-checkbox" data-key="${escapeHtml(item.dbKey)}">
                    </td>
                    <td>
                        <div class="cell-url-original" title="${escapeHtml(item.originalUrl)}">
                            ${escapeHtml(item.originalUrl)}
                        </div>
                    </td>
                    <td>
                        <a href="${item.shortUrl}" target="_blank" class="cell-url-short">
                            ${escapeHtml(displayUrl)}
                        </a>
                    </td>
                    <td class="text-center">
                        <span class="clicks-badge">${item.clicks}회</span>
                    </td>
                    <td class="text-right color-muted" style="font-size: 0.85rem;">
                        ${timeString}
                    </td>
                    <td class="text-center" style="display: flex; justify-content: center; gap: 4px;">
                        <button type="button" class="btn-icon copy-row-btn" data-url="${item.shortUrl}" title="복사">📋</button>
                        <button type="button" class="btn-icon qr-row-btn" data-url="${item.shortUrl}" title="QR 코드">📱</button>
                        <button type="button" class="btn-icon delete-row-btn" data-key="${escapeHtml(item.dbKey)}" title="삭제">🗑️</button>
                    </td>
                `;

                // Individual Action: Copy
                tr.querySelector('.copy-row-btn').addEventListener('click', (e) => {
                    const url = e.currentTarget.getAttribute('data-url');
                    copyToClipboard(url, '단축 링크가 클립보드에 복사되었습니다!');
                });

                // Individual Action: QR
                tr.querySelector('.qr-row-btn').addEventListener('click', (e) => {
                    const url = e.currentTarget.getAttribute('data-url');
                    currentShortUrl = url;
                    showResult(url);
                    // Force open QR block on single result card
                    qrCodeImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}`;
                    qrContainer.hidden = false;
                    qrToggleBtn.querySelector('span:first-child').textContent = 'QR 코드 숨기기';
                });

                // Individual Action: Delete
                tr.querySelector('.delete-row-btn').addEventListener('click', async (e) => {
                    const dbKey = e.currentTarget.getAttribute('data-key');
                    if (confirm(`이 단축 링크를 서버에서 영구 삭제하시겠습니까?\n주소: ${dbKey.replace(':', '/')}`)) {
                        await deleteLinksBatch([dbKey]);
                    }
                });

                // Checkbox toggle changes
                tr.querySelector('.history-row-checkbox').addEventListener('change', () => {
                    updateBulkDeleteBar();
                });

                historyList.appendChild(tr);
            });
        } catch (error) {
            console.error('Failed to load history:', error);
            showEmptyState(true);
        }
    }

    // Toggle all history checkboxes
    selectAllHistory.addEventListener('change', () => {
        const isChecked = selectAllHistory.checked;
        const rowCheckboxes = historyList.querySelectorAll('.history-row-checkbox');
        rowCheckboxes.forEach(cb => {
            cb.checked = isChecked;
        });
        updateBulkDeleteBar();
    });

    // Update batch delete bar visibility & count
    function updateBulkDeleteBar() {
        const checkedBoxes = historyList.querySelectorAll('.history-row-checkbox:checked');
        const totalRows = historyList.querySelectorAll('.history-row-checkbox').length;

        if (checkedBoxes.length > 0) {
            selectedCountVal.textContent = checkedBoxes.length;
            bulkDeleteBar.hidden = false;
        } else {
            bulkDeleteBar.hidden = true;
        }

        // Sync main selectAll checkbox state
        if (totalRows > 0 && checkedBoxes.length === totalRows) {
            selectAllHistory.checked = true;
        } else {
            selectAllHistory.checked = false;
        }
    }

    // Execute bulk delete on selected items
    btnDeleteSelected.addEventListener('click', async () => {
        const checkedBoxes = historyList.querySelectorAll('.history-row-checkbox:checked');
        if (checkedBoxes.length === 0) return;

        const keysToDelete = [];
        checkedBoxes.forEach(cb => {
            keysToDelete.push(cb.getAttribute('data-key'));
        });

        if (confirm(`선택한 ${keysToDelete.length}개의 단축 링크를 서버에서 모두 영구 삭제하시겠습니까?\n삭제된 링크는 더 이상 리다이렉트되지 않습니다.`)) {
            await deleteLinksBatch(keysToDelete);
        }
    });

    // API Call helper for deleting links in batch
    async function deleteLinksBatch(keys) {
        try {
            const response = await fetch('/api/delete-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keys })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || '링크 삭제 중 오류가 발생했습니다.');
            }

            // Remove deleted keys from LocalStorage
            keys.forEach(key => removeLocalKey(key));

            showToast(`${keys.length}개의 링크가 성공적으로 삭제되었습니다.`);
            
            // Reload history table
            loadHistory();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    // ==========================================
    // 5. Utility Helper Functions
    // ==========================================
    
    function isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (_) {
            return false;
        }
    }

    function setLoading(isLoading) {
        submitBtn.disabled = isLoading;
        longUrlInput.disabled = isLoading;
        domainSelect.disabled = isLoading;
        customCodeInput.disabled = isLoading;
        if (isLoading) {
            btnLoader.hidden = false;
            btnText.style.opacity = '0.5';
        } else {
            btnLoader.hidden = true;
            btnText.style.opacity = '1';
        }
    }

    function showError(msg) {
        errorMessage.textContent = `⚠️ ${msg}`;
        errorMessage.hidden = false;
    }

    function hideError() {
        errorMessage.hidden = true;
        errorMessage.textContent = '';
    }

    function showResult(shortUrl) {
        shortenedUrlInput.value = shortUrl;
        visitLink.href = shortUrl;
        
        // Reset QR code box state
        qrContainer.hidden = true;
        qrToggleBtn.querySelector('span:first-child').textContent = 'QR 코드 보기';
        
        resultCard.hidden = false;
        resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function showEmptyState(isEmpty) {
        if (isEmpty) {
            emptyState.style.display = 'flex';
            historyTable.style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            historyTable.style.display = 'table';
        }
    }

    function copyToClipboard(text, customMessage = '클립보드에 복사되었습니다!') {
        navigator.clipboard.writeText(text).then(() => {
            showToast(customMessage);
        }).catch(() => {
            // Fallback for older browsers / non-HTTPS local runs
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                showToast(customMessage);
            } catch (err) {
                showToast('복사에 실패했습니다.', 'error');
            }
            document.body.removeChild(textArea);
        });
    }

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icon = type === 'success' ? '✅' : '❌';
        toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
        
        toastContainer.appendChild(toast);

        // Auto remove toast after 3 seconds
        setTimeout(() => {
            toast.classList.add('fade-out');
            toast.addEventListener('animationend', () => {
                toast.remove();
            });
        }, 3000);
    }

    function formatTime(isoString) {
        try {
            const date = new Date(isoString);
            const now = new Date();
            const diffMs = now - date;
            
            const diffMins = Math.floor(diffMs / 60000);
            if (diffMins < 1) return '방금 전';
            if (diffMins < 60) return `${diffMins}분 전`;
            
            const diffHours = Math.floor(diffMins / 60);
            if (diffHours < 24) return `${diffHours}시간 전`;
            
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            return `${yyyy}.${mm}.${dd}`;
        } catch (e) {
            return '';
        }
    }

    function escapeHtml(string) {
        return String(string || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Local Storage Helpers for History Filter
    function saveLocalKey(dbKey) {
        const keys = getLocalKeys();
        if (!keys.includes(dbKey)) {
            keys.push(dbKey);
            localStorage.setItem('my_short_keys', JSON.stringify(keys));
        }
    }

    function getLocalKeys() {
        try {
            return JSON.parse(localStorage.getItem('my_short_keys') || '[]');
        } catch (e) {
            return [];
        }
    }

    function removeLocalKey(dbKey) {
        let keys = getLocalKeys();
        keys = keys.filter(k => k !== dbKey);
        localStorage.setItem('my_short_keys', JSON.stringify(keys));
    }

    // Initial load of history on load
    loadHistory();
});
