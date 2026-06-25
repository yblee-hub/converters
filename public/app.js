document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const shortenForm = document.getElementById('shorten-form');
    const longUrlInput = document.getElementById('long-url');
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
    
    const historyList = document.getElementById('history-list');
    const emptyState = document.getElementById('empty-state');
    const historyTable = document.getElementById('history-table');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const toastContainer = document.getElementById('toast-container');

    // State Variables
    let currentShortUrl = '';

    // Check for global redirect errors
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('error') && urlParams.get('error') === 'notfound') {
        showToast('존재하지 않거나 만료된 단축 링크입니다.', 'error');
        // Clean URL query params without reloading
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Toggle Advanced Settings
    advancedToggle.addEventListener('click', () => {
        advancedSettings.classList.toggle('open');
    });

    // Form Submit
    shortenForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const longUrl = longUrlInput.value.trim();
        const customCode = customCodeInput.value.trim();

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

        // Clear previous error
        hideError();
        setLoading(true);

        try {
            const response = await fetch('/api/shorten', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: longUrl, customCode: customCode || undefined })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '링크 단축 중 오류가 발생했습니다.');
            }

            // Success
            currentShortUrl = data.shortUrl;
            showResult(data.shortUrl);
            
            // Save to LocalStorage history tracking
            saveLocalShortCode(data.shortCode);
            
            // Refresh history table
            loadHistory();
            
            // Reset Form but keep Advanced settings state
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

    // Copy to Clipboard
    copyBtn.addEventListener('click', () => {
        copyToClipboard(currentShortUrl, '단축 링크가 클립보드에 복사되었습니다!');
    });

    // Close Result Card
    closeResultBtn.addEventListener('click', () => {
        resultCard.hidden = true;
    });

    // Toggle QR Code
    const qrLoader = document.querySelector('.qr-loader');
    
    // Hide loading text once QR code image actually loads
    qrCodeImg.addEventListener('load', () => {
        if (qrLoader) qrLoader.style.display = 'none';
    });

    qrToggleBtn.addEventListener('click', () => {
        if (qrContainer.hidden) {
            if (qrLoader) qrLoader.style.display = 'block';
            // Load QR code from dynamic generator API
            qrCodeImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(currentShortUrl)}`;
            qrContainer.hidden = false;
            qrToggleBtn.querySelector('span:first-child').textContent = 'QR 코드 숨기기';
        } else {
            qrContainer.hidden = true;
            qrToggleBtn.querySelector('span:first-child').textContent = 'QR 코드 보기';
        }
    });

    // Clear history action
    clearHistoryBtn.addEventListener('click', () => {
        if (confirm('최근 단축 내역을 브라우저에서 모두 지우시겠습니까? (서버 데이터는 삭제되지 않습니다)')) {
            localStorage.removeItem('my_short_codes');
            loadHistory();
            showToast('최근 내역이 초기화되었습니다.');
        }
    });

    // Helper functions
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
        // Display the actual working URL (local IP or production domain)
        shortenedUrlInput.value = shortUrl;
        visitLink.href = shortUrl;
        
        // Reset QR code box state
        qrContainer.hidden = true;
        qrToggleBtn.querySelector('span:first-child').textContent = 'QR 코드 보기';
        
        resultCard.hidden = false;
        resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function saveLocalShortCode(code) {
        const codes = getLocalShortCodes();
        if (!codes.includes(code)) {
            codes.push(code);
            localStorage.setItem('my_short_codes', JSON.stringify(codes));
        }
    }

    function getLocalShortCodes() {
        try {
            return JSON.parse(localStorage.getItem('my_short_codes') || '[]');
        } catch (e) {
            return [];
        }
    }

    async function loadHistory() {
        const localCodes = getLocalShortCodes();
        
        if (localCodes.length === 0) {
            showEmptyState(true);
            return;
        }

        try {
            const response = await fetch('/api/history');
            if (!response.ok) throw new Error();
            const data = await response.json();
            
            // Filter elements created by this client
            const filteredData = data.filter(item => localCodes.includes(item.shortCode));

            if (filteredData.length === 0) {
                showEmptyState(true);
                return;
            }

            showEmptyState(false);
            historyList.innerHTML = '';

            filteredData.forEach(item => {
                const tr = document.createElement('tr');
                
                const timeString = formatTime(item.createdAt);

                const displayUrl = item.shortUrl.replace(/^https?:\/\//, '');

                tr.innerHTML = `
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
                    <td class="text-center">
                        <button type="button" class="btn-icon copy-row-btn" data-url="${item.shortUrl}" title="복사">📋</button>
                        <button type="button" class="btn-icon qr-row-btn" data-url="${item.shortUrl}" title="QR 코드">📱</button>
                    </td>
                `;

                // Add button events
                tr.querySelector('.copy-row-btn').addEventListener('click', (e) => {
                    const url = e.currentTarget.getAttribute('data-url');
                    copyToClipboard(url, '단축 링크가 클립보드에 복사되었습니다!');
                });

                tr.querySelector('.qr-row-btn').addEventListener('click', (e) => {
                    const url = e.currentTarget.getAttribute('data-url');
                    currentShortUrl = url;
                    showResult(url);
                    // Force open QR
                    qrCodeImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}`;
                    qrContainer.hidden = false;
                    qrToggleBtn.querySelector('span:first-child').textContent = 'QR 코드 숨기기';
                });

                historyList.appendChild(tr);
            });
        } catch (error) {
            console.error('Failed to load history:', error);
            showEmptyState(true);
        }
    }

    function showEmptyState(isEmpty) {
        if (isEmpty) {
            emptyState.style.display = 'flex';
            historyTable.style.display = 'none';
            clearHistoryBtn.hidden = true;
        } else {
            emptyState.style.display = 'none';
            historyTable.style.display = 'table';
            clearHistoryBtn.hidden = false;
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

        // Auto remove toast
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
        return String(string)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Initial load
    loadHistory();
});
