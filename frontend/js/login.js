const htmlElement = document.documentElement;
const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
const storedThemePreference = localStorage.getItem('theme');
const initialTheme = storedThemePreference || (prefersDarkScheme ? 'dark' : 'light');

if (initialTheme === 'dark') {
    htmlElement.classList.add('dark');
} else {
    htmlElement.classList.remove('dark');
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');
    const themeToggle = document.getElementById('theme-toggle');
    const loginButton = loginForm?.querySelector('#login-button');
    const yearTarget = document.getElementById('login-year');

    if (yearTarget) {
        yearTarget.textContent = new Date().getFullYear();
    }

    const updateThemeIcon = (theme) => {
        if (!themeToggle) return;
        const iconName = theme === 'dark' ? 'sun' : 'moon';
        themeToggle.innerHTML = '';
        const icon = document.createElement('i');
        icon.setAttribute('data-feather', iconName);
        icon.className = 'h-5 w-5';
        themeToggle.appendChild(icon);
        feather.replace();
    };

    const applyTheme = (theme) => {
        if (theme === 'dark') {
            htmlElement.classList.add('dark');
        } else {
            htmlElement.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
        updateThemeIcon(theme);
    };

    applyTheme(initialTheme);

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const nextTheme = htmlElement.classList.contains('dark') ? 'light' : 'dark';
            applyTheme(nextTheme);
        });
    }

    if (localStorage.getItem('authToken')) {
        window.location.href = '../index.html';
        return;
    }

    const showError = (message) => {
        if (!errorMessage) return;
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    };

    const hideError = () => {
        if (!errorMessage) return;
        errorMessage.textContent = '';
        errorMessage.classList.add('hidden');
    };

    const setLoadingState = (isLoading) => {
        if (!loginButton) return;
        if (isLoading) {
            loginButton.setAttribute('aria-busy', 'true');
            loginButton.setAttribute('disabled', 'true');
            loginButton.classList.add('cursor-not-allowed', 'opacity-70');
        } else {
            loginButton.removeAttribute('aria-busy');
            loginButton.removeAttribute('disabled');
            loginButton.classList.remove('cursor-not-allowed', 'opacity-70');
        }
    };

    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(loginForm);
            const data = Object.fromEntries(formData.entries());

            hideError();
            setLoadingState(true);

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });

                const result = await response.json();

                if (response.ok) {
                    localStorage.setItem('authToken', result.accessToken);
                    localStorage.setItem('userRole', result.rol);
                    window.location.href = '../index.html';
                } else {
                    showError(result.error || 'Ocurrió un error desconocido.');
                }
            } catch (error) {
                console.error('Error de red:', error);
                showError('No se pudo conectar con el servidor.');
            } finally {
                setLoadingState(false);
            }
        });
    }
});
