// lock.js - Premium Finance Tracker Security System
(function() {
    const pwd = localStorage.getItem('appPassword');
    const unlocked = sessionStorage.getItem('isUnlocked');

    // If unlocked in this session, proceed normally
    if (unlocked) return;

    // Block rendering of the page immediately
    document.documentElement.style.display = 'none';

    window.addEventListener('DOMContentLoaded', () => {
        // Unhide the document element, but hide the body contents
        document.documentElement.style.display = '';
        
        const originalChildren = Array.from(document.body.children);
        originalChildren.forEach(child => {
            if (child.tagName !== 'SCRIPT') {
                child.style.display = 'none';
            }
        });

        // Background effect for the lock screen
        const bg = document.createElement('div');
        bg.className = 'background-blobs';
        bg.innerHTML = '<div class="blob blob-1"></div><div class="blob blob-2"></div><div class="blob blob-3"></div>';
        
        // Lock screen container
        const lockDiv = document.createElement('div');
        lockDiv.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            z-index: 9999; font-family: 'Outfit', sans-serif;
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            background: rgba(253, 251, 251, 0.5);
        `;
        
        const card = document.createElement('div');
        card.className = 'glass';
        card.style.cssText = `
            padding: 3rem; border-radius: 24px; text-align: center;
            box-shadow: 0 10px 40px rgba(0,0,0,0.15); width: 90%; max-width: 400px;
        `;
        
        const iconClass = pwd ? 'fa-lock' : 'fa-key';
        const titleText = pwd ? '請解鎖帳本' : '設定登入密碼';
        const descText = pwd ? '為保護您的財務隱私，請輸入密碼' : '這是您第一次使用，請設定一組保護密碼';
        const btnText = pwd ? '解鎖並進入' : '設定密碼';

        card.innerHTML = `
            <i class="fas ${iconClass}" style="font-size: 3.5rem; color: var(--primary); margin-bottom: 1.5rem;"></i>
            <h2 style="margin-bottom: 0.5rem; color: #333; font-weight: 700;">${titleText}</h2>
            <p style="color: var(--text-muted); margin-bottom: 2rem; font-size: 0.95rem;">${descText}</p>
            <form id="lock-form" style="display:flex; flex-direction:column; gap:1.2rem;">
                <input type="password" id="lock-pwd" required placeholder="請輸入密碼..." autocomplete="current-password"
                       style="padding:1.2rem; border-radius:16px; border:1px solid var(--glass-border); font-size:1.1rem; text-align:center; background: rgba(255,255,255,0.7); outline:none;">
                <button type="submit" class="btn-primary" style="padding:1.2rem; border-radius:16px; font-size:1.1rem; margin-top: 0.5rem;">
                    ${btnText}
                </button>
            </form>
            <p id="lock-error" style="color: var(--primary); margin-top: 1.5rem; font-size: 0.9rem; font-weight: bold; display: none; animation: shake 0.5s;">
                <i class="fas fa-exclamation-circle"></i> 密碼錯誤，請重新輸入
            </p>
        `;
        
        // Add shake animation
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-10px); }
                75% { transform: translateX(10px); }
            }
        `;
        document.head.appendChild(style);
        
        lockDiv.appendChild(card);
        document.body.appendChild(bg);
        document.body.appendChild(lockDiv);

        document.getElementById('lock-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('lock-pwd').value;
            if (!pwd) {
                localStorage.setItem('appPassword', input);
                sessionStorage.setItem('isUnlocked', 'true');
                window.location.reload();
            } else {
                if (input === pwd) {
                    sessionStorage.setItem('isUnlocked', 'true');
                    window.location.reload();
                } else {
                    const errorMsg = document.getElementById('lock-error');
                    errorMsg.style.display = 'block';
                    errorMsg.style.animation = 'none';
                    setTimeout(() => errorMsg.style.animation = '', 10);
                    document.getElementById('lock-pwd').value = '';
                }
            }
        });
    });
})();
