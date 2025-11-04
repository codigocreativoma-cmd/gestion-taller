document.addEventListener('DOMContentLoaded', () => {
    // --- LÓGICA DE SEGURIDAD ---
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = '../login.html';
        return;
    }

    // --- SELECTORES GLOBALES ---
    const sidebar = document.getElementById('sidebar');
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const overlay = document.getElementById('overlay');
    const logoutBtn = document.getElementById('logout-btn');
    const themeToggle = document.getElementById('theme-toggle');
    const themeToggleDesktop = document.getElementById('theme-toggle-desktop');
    const htmlElement = document.documentElement;

    const configForm = document.getElementById('config-form');
    const saveConfigBtn = document.getElementById('save-config-btn');
    const logoInput = document.getElementById('logo-input');
    const logoPreview = document.getElementById('logo-preview');

    let newLogoFile = null;

    // --- LÓGICA DEL PANEL (UI) ---
    const toggleMenu = () => {
        sidebar.classList.toggle('is-open');
        if (!overlay) return;
        const isOpen = sidebar.classList.contains('is-open');
        overlay.classList.toggle('is-visible', isOpen);
        overlay.classList.toggle('hidden', !isOpen);
    };
    if (hamburgerMenu) hamburgerMenu.addEventListener('click', toggleMenu);
    if (overlay) overlay.addEventListener('click', toggleMenu);

    const updateThemeIcons = (theme) => {
        [themeToggle, themeToggleDesktop].filter(Boolean).forEach(button => {
            const newIcon = document.createElement('i');
            newIcon.setAttribute('data-feather', theme === 'dark' ? 'sun' : 'moon');
            button.innerHTML = '';
            button.appendChild(newIcon);
        });
    };

    const applyTheme = (theme) => {
        if (theme === 'dark') {
            htmlElement.classList.add('dark');
        } else {
            htmlElement.classList.remove('dark');
        }
        updateThemeIcons(theme);
        feather.replace();
    };

    const storedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(storedTheme);

    const handleThemeToggle = () => {
        const newTheme = htmlElement.classList.contains('dark') ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    };

    [themeToggle, themeToggleDesktop].forEach(toggle => {
        if (toggle) {
            toggle.addEventListener('click', handleThemeToggle);
        }
    });
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('authToken');
            localStorage.removeItem('userRole');
            window.location.href = '../login.html';
        });
    }

    // --- LÓGICA DE CARGA DE CONFIGURACIÓN ---
    const loadConfig = async () => {
        if (!configForm) return;
        configForm.setAttribute('aria-busy', 'true');
        try {
            const response = await fetch('/api/configuracion', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('No se pudo cargar la configuración.');
            
            const result = await response.json();
            const config = result.data;

            configForm.elements['nombre_empresa'].value = config.nombre_empresa || '';
            configForm.elements['direccion_empresa'].value = config.direccion_empresa || '';
            configForm.elements['telefono_empresa'].value = config.telefono_empresa || '';
            configForm.elements['politicas'].value = (config.politicas || []).join('\n');

        } catch (error) {
            console.error("Error al cargar la configuración:", error);
            alert("Error al cargar la configuración del servidor.");
        } finally {
            configForm.removeAttribute('aria-busy');
        }
    };

    // --- MANEJO DE LA VISTA PREVIA DEL LOGO ---
    if (logoInput) {
        logoInput.addEventListener('change', () => {
            const file = logoInput.files[0];
            if (file) {
                newLogoFile = file;
                const reader = new FileReader();
                reader.onload = (e) => {
                    logoPreview.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // --- LÓGICA PARA GUARDAR LA CONFIGURACIÓN (CON ARCHIVO) ---
    if (configForm) {
        configForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            saveConfigBtn.setAttribute('aria-busy', 'true');
            saveConfigBtn.disabled = true;

            const formData = new FormData();
            formData.append('nombre_empresa', configForm.elements['nombre_empresa'].value);
            formData.append('direccion_empresa', configForm.elements['direccion_empresa'].value);
            formData.append('telefono_empresa', configForm.elements['telefono_empresa'].value);
            formData.append('politicas', configForm.elements['politicas'].value);

            if (newLogoFile) {
                formData.append('logo_file', newLogoFile);
            }

            try {
                const response = await fetch('/api/configuracion', {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                const result = await response.json();

                if (response.ok) {
                    alert('¡Configuración guardada con éxito! La página se recargará para aplicar los cambios.');
                    // CORRECCIÓN CLAVE: Forzamos una recarga que limpia el caché
                    window.location.reload(true);
                } else {
                    throw new Error(result.error);
                }

            } catch (error) {
                console.error("Error al guardar la configuración:", error);
                alert(`Error al guardar: ${error.message}`);
            } finally {
                saveConfigBtn.removeAttribute('aria-busy');
                saveConfigBtn.disabled = false;
            }
        });
    }
    
    // --- INICIALIZACIÓN ---
    const setCacheBustedLogo = () => {
        // Esta función encontrará todos los logos y les añadirá un parámetro único
        const logos = document.querySelectorAll('.sidebar-logo, .logo-preview');
        logos.forEach(logo => {
            // Añadimos la fecha y hora actual para "engañar" al caché
            logo.src = `../img/logo.png?v=${new Date().getTime()}`;
        });
    };

    loadConfig();
    setCacheBustedLogo(); // La llamamos al cargar la página
    feather.replace();
});