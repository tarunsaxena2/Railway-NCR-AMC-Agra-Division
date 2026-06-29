// frontend/js/signup.js

document.addEventListener('DOMContentLoaded', () => {

    const API_BASE_URL = 'http://localhost:5000';

    // ── DOM refs ──────────────────────────────────────────────────────────────
    const form        = document.getElementById('signupForm');
    const nameEl      = document.getElementById('name');
    const emailEl     = document.getElementById('email');
    const phoneEl     = document.getElementById('phone');
    const passwordEl  = document.getElementById('password');
    const roleEl      = document.getElementById('role');
    const submitBtn   = document.getElementById('submitBtn');
    const msgEl       = document.getElementById('signupMessage');
    const eyeBtn      = document.getElementById('eyeBtn');
    const eyeIcon     = document.getElementById('eyeIcon');
    const strengthWrap  = document.getElementById('strengthWrap');
    const strengthBar   = document.getElementById('strengthBar');
    const strengthLabel = document.getElementById('strengthLabel');

    if (!form) return;

    // ── Message helper (matches new blue-white CSS: class = 'success'/'error') ──
    function setMessage(text, type) {
        if (!msgEl) return;
        msgEl.textContent = text;
        msgEl.className   = `message ${type}`;
        if (type === 'success') {
            setTimeout(() => { msgEl.className = 'message'; msgEl.textContent = ''; }, 7000);
        }
    }

    // ── Field error highlight ────────────────────────────────────────────────
    function setFieldError(el, hasError) {
        if (el) el.classList.toggle('error-field', hasError);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 1 · SHOW / HIDE PASSWORD
    // ════════════════════════════════════════════════════════════════════════
    if (eyeBtn && passwordEl && eyeIcon) {
        eyeBtn.addEventListener('click', () => {
            const show        = passwordEl.type === 'password';
            passwordEl.type   = show ? 'text' : 'password';
            eyeIcon.className = show ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
            eyeBtn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // 2 · PASSWORD STRENGTH METER
    // ════════════════════════════════════════════════════════════════════════
    const rules = [
        { id: 'chk-length',  test: p => p.length >= 8, text: 'At least 8 characters' },
        { id: 'chk-lower',   test: p => /[a-z]/.test(p), text: 'At least 1 lowercase letter' },
        { id: 'chk-upper',   test: p => /[A-Z]/.test(p), text: 'At least 1 uppercase letter' },
        { id: 'chk-number',  test: p => /[0-9]/.test(p), text: 'At least 1 numeral' },
        { id: 'chk-special', test: p => /[^A-Za-z0-9]/.test(p), text: 'At least 1 special character' },
    ];

    function evaluatePassword(pwd) {
        const passed = rules.map(r => r.test(pwd));
        const score  = passed.filter(Boolean).length;
        
        let level = 'weak';
        if (score >= 3 && score < 5) level = 'medium';
        if (score === 5) level = 'strong';
        
        return { score, level, passed };
    }

    const STRENGTH_CFG = {
        weak:   { pct: '33%',  bar: '#ef4444', label: '🔴 Weak (Missing Requirements)', text: '#ef4444' },
        medium: { pct: '66%',  bar: '#f59e0b', label: '🟡 Medium (Missing Requirements)', text: '#f59e0b' },
        strong: { pct: '100%', bar: '#16a34a', label: '🟢 Strong (All Rules Passed)', text: '#16a34a' },
    };

    function updateStrengthUI(pwd) {
        if (!strengthWrap) return;
        if (!pwd) { strengthWrap.style.display = 'none'; return; }

        strengthWrap.style.display = 'block';
        const { score, level, passed } = evaluatePassword(pwd);
        const cfg = STRENGTH_CFG[level];

        strengthBar.style.width      = cfg.pct;
        strengthBar.style.background = cfg.bar;
        strengthLabel.textContent    = cfg.label;
        strengthLabel.style.color    = cfg.text;

        rules.forEach((rule, i) => {
            const el = document.getElementById(rule.id);
            if (!el) return;
            const icon = el.querySelector('i');
            el.classList.toggle('pass', passed[i]);
            if (icon) {
                icon.className = passed[i] ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-xmark';
            }
        });
    }

    if (passwordEl) {
        passwordEl.addEventListener('input', () => updateStrengthUI(passwordEl.value));
    }

    // Phone: allow only digits, max 10 characters
    if (phoneEl) {
        phoneEl.addEventListener('input', () => {
            phoneEl.value = phoneEl.value.replace(/[^0-9]/g, '').slice(0, 10);
        });
        phoneEl.addEventListener('keypress', (e) => {
            if (!/[0-9]/.test(e.key)) e.preventDefault();
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // 3 · FRONTEND VALIDATION
    // ════════════════════════════════════════════════════════════════════════
    function validateForm(name, email, phone, password, role) {
        [nameEl, emailEl, phoneEl, passwordEl].forEach(el => setFieldError(el, false));

        if (!name) {
            setFieldError(nameEl, true);
            return { valid: false, message: 'Full name is required.' };
        }
        if (name.length < 2) {
            setFieldError(nameEl, true);
            return { valid: false, message: 'Full name must be at least 2 characters.' };
        }
        if (!email) {
            setFieldError(emailEl, true);
            return { valid: false, message: 'Email address is required.' };
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setFieldError(emailEl, true);
            return { valid: false, message: 'Please enter a valid email address.' };
        }
        // Phone is only required for user and technician roles, not admin
        if (role !== 'admin') {
            if (!phone) {
                setFieldError(phoneEl, true);
                return { valid: false, message: 'Phone number is required.' };
            }
            if (!/^[6-9]\d{9}$/.test(phone)) {
                setFieldError(phoneEl, true);
                return { valid: false, message: 'Please enter a valid 10-digit Indian mobile number (starting with 6-9).' };
            }
        }
        if (!password) {
            setFieldError(passwordEl, true);
            return { valid: false, message: 'Password is required.' };
        }

        // Strictly enforcing all 5 metrics must evaluate to true
        const { score } = evaluatePassword(password);
        if (score < 5) {
            setFieldError(passwordEl, true);
            return { valid: false, message: 'Password does not meet validation safety parameters. Please address all remaining items listed below.' };
        }
        if (!['user', 'technician', 'admin'].includes(role)) {
            return { valid: false, message: 'Please select a valid role.' };
        }
        return { valid: true, message: '' };
    }

    // ════════════════════════════════════════════════════════════════════════
    // 4 · FORM SUBMIT
    // ════════════════════════════════════════════════════════════════════════
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name     = nameEl.value.trim();
        const email    = emailEl.value.trim();
        const phone    = phoneEl ? phoneEl.value.trim() : '';
        const password = passwordEl.value;      // no trim — preserve special chars
        const role     = roleEl.value;

        const { valid, message } = validateForm(name, email, phone, password, role);
        if (!valid) { setMessage(message, 'error'); return; }

        submitBtn.disabled    = true;
        submitBtn.textContent = 'Creating Account…';

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ name, email, phone: role !== 'admin' ? phone : undefined, password, role }),
            });

            const data = await response.json();

           if (response.ok) {

    // Registration successful
    setMessage(
        "✓ Account created successfully! Please login with your email and password.",
        "success"
    );

    // Form clear kar do
    form.reset();

    // Login page par redirect
    setTimeout(() => {
        window.location.href = "login.html";
    }, 2000);

            } else {
                setMessage(data.message || 'Registration failed. Please try again.', 'error');
                submitBtn.disabled    = false;
                submitBtn.textContent = 'Create Account';
            }

        } catch (err) {
            console.error('[signup] fetch error:', err);
            setMessage('Network error. Please ensure the server is running and try again.', 'error');
            submitBtn.disabled    = false;
            submitBtn.textContent = 'Create Account';
        }
    });
});