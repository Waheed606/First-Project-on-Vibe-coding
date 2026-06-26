document.addEventListener('DOMContentLoaded', () => {
    // State management
    let releases = [];
    let activeCategory = 'All';
    let searchQuery = '';
    let lastFetchedTime = null;

    // Selection & Tweet state
    const selectedNotes = new Set();
    let currentTweetText = '';
    let currentTweetSource = null; // 'card', 'selection-bar', 'highlight'
    let currentSingleNote = null;
    let currentMultipleNotes = [];
    let highlightedSelectionText = '';

    // DOM Elements
    const feedContainer = document.getElementById('feed-container');
    const emptyState = document.getElementById('empty-state');
    const totalCountEl = document.getElementById('total-count');
    const featuresCountEl = document.getElementById('features-count');
    const fixesCountEl = document.getElementById('fixes-count');
    const lastUpdatedTimeEl = document.getElementById('last-updated-time');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const refreshIcon = document.getElementById('refresh-icon');
    const spinnerIcon = document.getElementById('spinner-icon');
    const connectionStatus = document.getElementById('connection-status');
    const categoryFilters = document.getElementById('category-filters');
    const alertBanner = document.getElementById('alert-banner');
    const alertText = document.getElementById('alert-text');
    const alertCloseBtn = document.getElementById('alert-close-btn');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    const scrollTopBtn = document.getElementById('scroll-top-btn');

    // Tweet and Selection DOM Elements
    const tweetModal = document.getElementById('tweet-modal');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const tweetOptionsPanel = document.getElementById('tweet-options-panel');
    const tweetOptBadges = document.getElementById('tweet-opt-badges');
    const tweetOptDate = document.getElementById('tweet-opt-date');
    const tweetOptLink = document.getElementById('tweet-opt-link');
    const charProgressFg = document.getElementById('char-progress-fg');
    const tweetCharCount = document.getElementById('tweet-char-count');
    const publishTweetBtn = document.getElementById('publish-tweet-btn');
    const cancelTweetBtn = document.getElementById('cancel-tweet-btn');
    const closeTweetModal = document.getElementById('close-tweet-modal');

    const selectionBar = document.getElementById('selection-bar');
    const selectedCountBadge = document.getElementById('selected-count-badge');
    const selectedCountText = document.getElementById('selected-count-text');
    const selectionClearBtn = document.getElementById('selection-clear-btn');
    const selectionTweetBtn = document.getElementById('selection-tweet-btn');
    const floatingTweetBtn = document.getElementById('floating-tweet-btn');

    // Initial load
    fetchReleases(false);

    // Fetch releases from API
    async function fetchReleases(forceRefresh = false) {
        setLoadingState(true);
        showAlert(null); // Hide any open alerts

        try {
            const url = forceRefresh ? '/api/releases?refresh=true' : '/api/releases';
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.status === 'success' || result.status === 'warning') {
                releases = result.data || [];
                lastFetchedTime = result.last_updated;
                
                updateStats(releases);
                renderReleases();
                
                // Show warning alert if feed fetch failed but served stale cache
                if (result.status === 'warning') {
                    showAlert(result.message, 'warning');
                    setConnectionStatus('Cached / Offline', 'error-status');
                } else {
                    setConnectionStatus(result.source === 'cache' ? 'Cached' : 'Connected', 'connected');
                }
            } else {
                throw new Error(result.message || 'Unknown error occurred');
            }
        } catch (error) {
            console.error('Error fetching release notes:', error);
            showAlert(`Failed to fetch release notes: ${error.message}. Please try again later.`, 'danger');
            setConnectionStatus('Disconnected', 'error-status');
            
            // If we don't have any releases in memory, show empty state
            if (releases.length === 0) {
                showEmptyState(true);
            }
        } finally {
            setLoadingState(false);
        }
    }

    // Set loading indicator states
    function setLoadingState(isLoading) {
        if (isLoading) {
            refreshBtn.disabled = true;
            refreshIcon.classList.add('hidden');
            spinnerIcon.classList.remove('hidden');
            
            // Show skeleton loaders if no releases are currently displayed
            if (releases.length === 0) {
                feedContainer.innerHTML = generateSkeletons(3);
                emptyState.classList.add('hidden');
            }
            setConnectionStatus('Syncing...', 'loading');
        } else {
            refreshBtn.disabled = false;
            refreshIcon.classList.remove('hidden');
            spinnerIcon.classList.add('hidden');
        }
    }

    // Update connection status badge
    function setConnectionStatus(text, className) {
        connectionStatus.className = `status-badge ${className}`;
        connectionStatus.querySelector('.status-text').textContent = text;
    }

    // Generate HTML for skeleton loader
    function generateSkeletons(count) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="skeleton-card card">
                    <div class="skeleton-shimmer"></div>
                    <div class="skeleton-header">
                        <div class="skeleton-line short"></div>
                        <div class="skeleton-badges">
                            <div class="skeleton-badge"></div>
                        </div>
                    </div>
                    <div class="skeleton-body">
                        <div class="skeleton-line"></div>
                        <div class="skeleton-line medium"></div>
                    </div>
                </div>
            `;
        }
        return html;
    }

    // Display Alert Banner
    function showAlert(message, type = 'warning') {
        if (!message) {
            alertBanner.classList.add('hidden');
            return;
        }
        
        alertBanner.className = `alert alert-${type}`;
        alertText.textContent = message;
        alertBanner.classList.remove('hidden');
    }

    // Close alert click
    alertCloseBtn.addEventListener('click', () => {
        alertBanner.classList.add('hidden');
    });

    // Update statistics dashboard panel
    function updateStats(data) {
        totalCountEl.textContent = data.length;
        
        let featureCount = 0;
        let fixCount = 0;
        
        data.forEach(item => {
            if (item.categories.includes('Feature')) featureCount++;
            if (item.categories.includes('Fix')) fixCount++;
        });
        
        featuresCountEl.textContent = featureCount;
        fixesCountEl.textContent = fixCount;
        
        if (lastFetchedTime) {
            const date = new Date(lastFetchedTime * 1000);
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            lastUpdatedTimeEl.textContent = timeStr;
            lastUpdatedTimeEl.title = date.toLocaleString();
        }
    }

    // Filter and Render release cards
    function renderReleases() {
        feedContainer.innerHTML = '';
        
        // Filter logical entries
        const filtered = releases.filter(note => {
            // 1. Category Filter
            const matchesCategory = activeCategory === 'All' || note.categories.includes(activeCategory);
            
            // 2. Search Text Query
            const textToSearch = `${note.title} ${note.content} ${note.categories.join(' ')}`.toLowerCase();
            const matchesSearch = textToSearch.includes(searchQuery.toLowerCase());
            
            return matchesCategory && matchesSearch;
        });

        if (filtered.length === 0) {
            showEmptyState(true);
            return;
        }

        showEmptyState(false);

        filtered.forEach(note => {
            const card = document.createElement('article');
            
            // Determine category border styling based on tags
            let borderClass = 'note-has-general';
            if (note.categories.includes('Feature')) borderClass = 'note-has-feature';
            else if (note.categories.includes('Fix')) borderClass = 'note-has-fix';
            else if (note.categories.includes('Change')) borderClass = 'note-has-change';
            else if (note.categories.includes('Deprecation')) borderClass = 'note-has-deprecation';
            else if (note.categories.includes('Security')) borderClass = 'note-has-security';
            else if (note.categories.includes('Announcement')) borderClass = 'note-has-announcement';
            
            const isSelected = selectedNotes.has(note.id);
            card.className = `note-card card ${borderClass} ${isSelected ? 'selected-card' : ''}`;
            
            // Format category badges
            const badgesHtml = note.categories.map(cat => {
                const lowerCat = cat.toLowerCase();
                // Assign matching CSS modifier class
                let classModifier = 'general';
                if (['feature', 'fix', 'change', 'deprecation', 'security', 'announcement'].includes(lowerCat)) {
                    classModifier = lowerCat;
                }
                return `<span class="badge badge-${classModifier}">${cat}</span>`;
            }).join('');

            // Clean link parsing
            const linkHtml = note.link ? `
                <a href="${note.link}" class="note-link-btn" target="_blank" rel="noopener noreferrer">
                    <span>View Official Docs</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="7" y1="17" x2="17" y2="7"></line>
                        <polyline points="7 7 17 7 17 17"></polyline>
                    </svg>
                </a>
            ` : '';

            card.innerHTML = `
                <div class="note-card-header">
                    <div class="note-date-area">
                        <div class="note-select-container">
                            <input type="checkbox" class="note-checkbox" id="chk-${note.id}" data-id="${note.id}" ${isSelected ? 'checked' : ''}>
                        </div>
                        <span class="note-date-icon">📅</span>
                        <span class="note-date">${note.title}</span>
                    </div>
                    <div class="note-badges-container">
                        ${badgesHtml}
                    </div>
                </div>
                <div class="note-content">
                    ${note.content}
                </div>
                <div class="note-card-footer">
                    <button class="card-tweet-btn" data-id="${note.id}" title="Draft tweet for this update">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        <span>Tweet Update</span>
                    </button>
                    ${linkHtml}
                </div>
            `;
            
            feedContainer.appendChild(card);
        });
    }

    // Toggle Empty State display
    function showEmptyState(show) {
        if (show) {
            feedContainer.classList.add('hidden');
            emptyState.classList.remove('hidden');
        } else {
            feedContainer.classList.remove('hidden');
            emptyState.classList.add('hidden');
        }
    }

    // Category Filter Selection
    categoryFilters.addEventListener('click', (e) => {
        const target = e.target.closest('.filter-badge');
        if (!target) return;

        // Toggle Active style
        document.querySelectorAll('.filter-badge').forEach(badge => {
            badge.classList.remove('active');
        });
        target.classList.add('active');

        activeCategory = target.dataset.category;
        renderReleases();
    });

    // Search Input Event
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        
        if (searchQuery.trim() !== '') {
            clearSearchBtn.classList.remove('hidden');
        } else {
            clearSearchBtn.classList.add('hidden');
        }
        
        renderReleases();
    });

    // Clear Search Field
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.classList.add('hidden');
        searchInput.focus();
        renderReleases();
    });

    // Refresh Button Event
    refreshBtn.addEventListener('click', () => {
        fetchReleases(true);
    });

    // Reset Filters from Empty state button
    resetFiltersBtn.addEventListener('click', () => {
        // Reset Search
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.classList.add('hidden');

        // Reset Badges active status
        document.querySelectorAll('.filter-badge').forEach(badge => {
            badge.classList.remove('active');
            if (badge.dataset.category === 'All') {
                badge.classList.add('active');
            }
        });
        activeCategory = 'All';

        renderReleases();
    });

    // Scroll to Top behavior
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            scrollTopBtn.classList.remove('hidden');
        } else {
            scrollTopBtn.classList.add('hidden');
        }
    });

    scrollTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    // ----------------------------------------------------
    // Twitter Integration & Selection Functions
    // ----------------------------------------------------

    // Helper: clean XML HTML content and output formatted text
    function extractTextFromHtml(html) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Formulate readable headers inside notes
        tempDiv.querySelectorAll('.release-note-header').forEach(h => {
            h.innerText = `\n${h.innerText.toUpperCase()}\n`;
        });
        
        // Bullet point formatting for lists
        tempDiv.querySelectorAll('li').forEach(li => {
            li.innerText = `• ${li.innerText.trim()}\n`;
        });
        
        // Paragraph newlines
        tempDiv.querySelectorAll('p').forEach(p => {
            p.innerText = `${p.innerText.trim()}\n`;
        });

        let text = tempDiv.innerText || tempDiv.textContent || "";
        text = text.replace(/\n{3,}/g, '\n\n').trim();
        return text;
    }

    // Update Bottom Selection Action Bar visibility and count
    function updateSelectionBar() {
        const count = selectedNotes.size;
        selectedCountBadge.textContent = count;
        selectedCountText.textContent = count === 1 ? 'update selected' : 'updates selected';
        
        if (count > 0) {
            selectionBar.classList.remove('hidden');
        } else {
            selectionBar.classList.add('hidden');
        }
    }

    // Selection Action Bar Events
    selectionClearBtn.addEventListener('click', () => {
        selectedNotes.clear();
        document.querySelectorAll('.note-checkbox').forEach(cb => cb.checked = false);
        document.querySelectorAll('.note-card').forEach(card => card.classList.remove('selected-card'));
        updateSelectionBar();
    });

    selectionTweetBtn.addEventListener('click', () => {
        const notesToTweet = releases.filter(n => selectedNotes.has(n.id));
        if (notesToTweet.length > 0) {
            openTweetModalForMultipleNotes(notesToTweet);
        }
    });

    // Event Delegation on Feed Container for dynamic card clicks
    feedContainer.addEventListener('click', (e) => {
        // Toggle card checkbox
        const checkbox = e.target.closest('.note-checkbox');
        if (checkbox) {
            const noteId = checkbox.dataset.id;
            const card = checkbox.closest('.note-card');
            if (checkbox.checked) {
                selectedNotes.add(noteId);
                card.classList.add('selected-card');
            } else {
                selectedNotes.delete(noteId);
                card.classList.remove('selected-card');
            }
            updateSelectionBar();
            return;
        }

        // Direct Tweet Update Button click
        const tweetBtn = e.target.closest('.card-tweet-btn');
        if (tweetBtn) {
            const noteId = tweetBtn.dataset.id;
            const targetNote = releases.find(n => n.id === noteId);
            if (targetNote) {
                openTweetModalForNote(targetNote);
            }
            return;
        }
    });

    // Character Counter progress calculation
    function updateCharCount() {
        const text = tweetTextarea.value;
        const count = text.length;
        const limit = 280;
        const remaining = limit - count;
        
        tweetCharCount.textContent = remaining;
        
        // Progress Ring Circumference Calculations
        const radius = 10;
        const circumference = 2 * Math.PI * radius;
        const percentage = Math.min(count / limit, 1);
        const offset = circumference - (percentage * circumference);
        
        charProgressFg.style.strokeDashoffset = offset;
        
        // Visual Limit Alerts
        if (remaining < 0) {
            tweetCharCount.classList.add('overlimit');
            charProgressFg.style.stroke = 'var(--color-deprecation)';
            publishTweetBtn.disabled = true;
        } else if (remaining <= 20) {
            tweetCharCount.classList.remove('overlimit');
            charProgressFg.style.stroke = 'var(--color-fix)';
            publishTweetBtn.disabled = false;
        } else {
            tweetCharCount.classList.remove('overlimit');
            charProgressFg.style.stroke = 'var(--color-primary)';
            publishTweetBtn.disabled = false;
        }
    }

    tweetTextarea.addEventListener('input', updateCharCount);

    // Customize draft based on checkbox options change
    [tweetOptBadges, tweetOptDate, tweetOptLink].forEach(chk => {
        chk.addEventListener('change', () => {
            if (currentTweetSource === 'card') {
                generateTweetTextForSingle();
            } else if (currentTweetSource === 'selection-bar') {
                generateTweetTextForMultiple();
            }
        });
    });

    // Single Note Tweet generation
    function openTweetModalForNote(note) {
        currentTweetSource = 'card';
        currentSingleNote = note;
        tweetOptionsPanel.classList.remove('hidden');
        
        generateTweetTextForSingle();
        tweetModal.classList.remove('hidden');
        tweetTextarea.focus();
    }

    function generateTweetTextForSingle() {
        if (!currentSingleNote) return;
        const note = currentSingleNote;
        
        let header = '';
        if (tweetOptBadges.checked && note.categories.length > 0) {
            header += note.categories.map(c => `[${c}]`).join(' ') + ' ';
        }
        if (tweetOptDate.checked && note.title) {
            header += `(${note.title}) `;
        }
        
        let body = extractTextFromHtml(note.content);
        
        let link = '';
        if (tweetOptLink.checked && note.link) {
            link += `\n\nDocs: ${note.link}`;
        }
        
        // Try to keep formatting but let user prune length manually
        currentTweetText = `${header.trim()}\n\n${body}${link}`;
        tweetTextarea.value = currentTweetText;
        updateCharCount();
    }

    // Multiple Notes digest generation
    function openTweetModalForMultipleNotes(notes) {
        currentTweetSource = 'selection-bar';
        currentMultipleNotes = notes;
        tweetOptionsPanel.classList.remove('hidden');
        
        generateTweetTextForMultiple();
        tweetModal.classList.remove('hidden');
        tweetTextarea.focus();
    }

    function generateTweetTextForMultiple() {
        if (currentMultipleNotes.length === 0) return;
        
        let intro = `🔥 Latest BigQuery Updates:\n`;
        let bulletPoints = '';
        
        currentMultipleNotes.forEach((note, index) => {
            let catStr = '';
            if (tweetOptBadges.checked && note.categories.length > 0) {
                catStr = `[${note.categories[0]}] `;
            }
            let dateStr = '';
            if (tweetOptDate.checked && note.title) {
                dateStr = `${note.title}: `;
            }
            
            let desc = extractTextFromHtml(note.content);
            const lines = desc.split('\n');
            let firstLine = lines.length > 0 ? lines[0] : '';
            if (firstLine.length > 60) {
                firstLine = firstLine.substring(0, 57) + '...';
            }
            
            bulletPoints += `\n${index + 1}. ${catStr}${dateStr}${firstLine}`;
        });
        
        let link = '';
        if (tweetOptLink.checked) {
            const firstWithLink = currentMultipleNotes.find(n => n.link);
            if (firstWithLink) {
                link = `\n\nExplore: ${firstWithLink.link}`;
            }
        }
        
        currentTweetText = intro + bulletPoints + link;
        tweetTextarea.value = currentTweetText;
        updateCharCount();
    }

    // Text Selection / Highlight Tweet flow
    function openTweetModalForHighlight(text) {
        currentTweetSource = 'highlight';
        highlightedSelectionText = text;
        tweetOptionsPanel.classList.add('hidden'); // Hide auto settings for pure highlights
        
        currentTweetText = `"${text}"\n\n#BigQuery`;
        tweetTextarea.value = currentTweetText;
        updateCharCount();
        tweetModal.classList.remove('hidden');
        tweetTextarea.focus();
    }

    let selectionTimeout;
    document.addEventListener('selectionchange', () => {
        clearTimeout(selectionTimeout);
        selectionTimeout = setTimeout(handleTextSelection, 250);
    });

    function handleTextSelection() {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        if (selectedText.length > 0) {
            let node = selection.anchorNode;
            let isInsideCard = false;
            while (node) {
                if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('note-card')) {
                    isInsideCard = true;
                    break;
                }
                node = node.parentNode;
            }
            
            if (isInsideCard) {
                try {
                    const range = selection.getRangeAt(0);
                    const rect = range.getBoundingClientRect();
                    
                    floatingTweetBtn.style.top = `${rect.top + window.scrollY - 42}px`;
                    floatingTweetBtn.style.left = `${rect.left + window.scrollX + (rect.width / 2) - 60}px`;
                    floatingTweetBtn.classList.remove('hidden');
                    
                    highlightedSelectionText = selectedText;
                } catch (e) {
                    floatingTweetBtn.classList.add('hidden');
                }
            } else {
                floatingTweetBtn.classList.add('hidden');
            }
        } else {
            floatingTweetBtn.classList.add('hidden');
        }
    }

    floatingTweetBtn.addEventListener('click', () => {
        if (highlightedSelectionText) {
            openTweetModalForHighlight(highlightedSelectionText);
            window.getSelection().removeAllRanges();
            floatingTweetBtn.classList.add('hidden');
        }
    });

    // Close Modal actions
    function hideTweetModal() {
        tweetModal.classList.add('hidden');
    }

    cancelTweetBtn.addEventListener('click', hideTweetModal);
    closeTweetModal.addEventListener('click', hideTweetModal);
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) {
            hideTweetModal();
        }
    });

    // Centered Tweet Window intent dispatch
    publishTweetBtn.addEventListener('click', () => {
        const text = encodeURIComponent(tweetTextarea.value);
        const url = `https://x.com/intent/tweet?text=${text}`;
        
        const width = 550;
        const height = 450;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);
        
        window.open(url, '_blank', `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`);
        
        hideTweetModal();
    });
});
