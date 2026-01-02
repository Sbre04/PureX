document.addEventListener('DOMContentLoaded', () => {
    const botCountEl = document.getElementById('bot-count');
    const autoCleanCheckbox = document.getElementById('auto-clean-check');
    const menuBtn = document.getElementById('menu-btn');
    const closeMenuBtn = document.getElementById('close-menu-btn');
    const sideMenu = document.getElementById('side-menu');
    const openWhitelistBtn = document.getElementById('open-whitelist-btn');
    const whitelistScreen = document.getElementById('whitelist-screen');
    const backFromWhitelistBtn = document.getElementById('back-from-whitelist');
    const whitelistUl = document.getElementById('whitelist-ul');
    const emptyState = document.getElementById('empty-state');


    chrome.storage.local.get(['botCount', 'autoClean'], (data) => {
        if(botCountEl) botCountEl.innerText = data.botCount || 0;
        if (autoCleanCheckbox) autoCleanCheckbox.checked = !!data.autoClean;
    });

    if (autoCleanCheckbox) {
        autoCleanCheckbox.addEventListener('change', (e) => {
            chrome.storage.local.set({ autoClean: e.target.checked });
        });
    }


    menuBtn.addEventListener('click', () => sideMenu.classList.add('open'));
    closeMenuBtn.addEventListener('click', () => sideMenu.classList.remove('open'));
    document.addEventListener('click', (e) => {
        if (!sideMenu.contains(e.target) && !menuBtn.contains(e.target) && sideMenu.classList.contains('open')) {
            sideMenu.classList.remove('open');
        }
    });


    openWhitelistBtn.addEventListener('click', () => {
        renderWhitelist();
        whitelistScreen.classList.add('visible');
        sideMenu.classList.remove('open');
    });

    backFromWhitelistBtn.addEventListener('click', () => {
        whitelistScreen.classList.remove('visible');
    });

    function renderWhitelist() {
        whitelistUl.innerHTML = '';
        chrome.storage.local.get(['whitelistedUsers'], (data) => {
            const users = data.whitelistedUsers || [];
            if (users.length === 0) {
                emptyState.style.display = 'block';
                return;
            }
            emptyState.style.display = 'none';

            users.forEach(handle => {
                const li = document.createElement('li');
                li.className = 'whitelist-item';
                const displayHandle = handle.startsWith('/') ? handle.substring(1) : handle;

                li.innerHTML = `
                    <span class="user-handle">@${displayHandle}</span>
                    <button class="remove-btn" title="Remove">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                `;
                li.querySelector('.remove-btn').addEventListener('click', () => removeFromWhitelist(handle));
                whitelistUl.appendChild(li);
            });
        });
    }

    function removeFromWhitelist(handle) {
        chrome.storage.local.get(['whitelistedUsers'], (data) => {
            const newUsers = (data.whitelistedUsers || []).filter(u => u !== handle);
            chrome.storage.local.set({ whitelistedUsers: newUsers }, () => renderWhitelist());
        });
    }
    const devSignature = document.getElementById('dev-signature');
    if (devSignature) {
        devSignature.addEventListener('click', () => {
            chrome.tabs.create({ url: 'https://x.com/@Davide_DeRosaa' });
        });
    }
});