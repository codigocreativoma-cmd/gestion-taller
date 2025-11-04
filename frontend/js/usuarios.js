document.addEventListener('DOMContentLoaded', () => {
    // --- LÓGICA DE SEGURIDAD Y ROLES ---
    const token = localStorage.getItem('authToken');
    const userRole = localStorage.getItem('userRole');
    if (!token) {
        window.location.href = '../login.html';
        return;
    }
    if (userRole) {
        document.body.classList.add(`rol-${userRole}`);
    }

    // --- SELECTORES GLOBALES ---
    const body = document.body;
    const sidebar = document.getElementById('sidebar');
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const overlay = document.getElementById('overlay');
    const themeToggle = document.getElementById('theme-toggle');
    const themeToggleDesktop = document.getElementById('theme-toggle-desktop');
    const htmlElement = document.documentElement;
    const logoutBtn = document.getElementById('logout-btn');

    const showFormButtons = document.querySelectorAll('.js-show-form');
    const hideFormButtons = document.querySelectorAll('.js-hide-form');
    
    const userForm = document.getElementById('user-form');
    const usersTbody = document.getElementById('users-tbody');

    // --- LÓGICA DE LA INTERFAZ PRINCIPAL ---
    const showForm = () => body.classList.add('form-active');
    const hideForm = () => {
        body.classList.remove('form-active');
        userForm.reset();
    };
    showFormButtons.forEach(btn => btn.addEventListener('click', showForm));
    hideFormButtons.forEach(btn => btn.addEventListener('click', hideForm));

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
            localStorage.removeItem('userRole'); // Clear role on logout
            window.location.href = '../login.html';
        });
    }

    // --- LÓGICA DEL FORMULARIO DE NUEVO USUARIO ---
    if (userForm) {
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(userForm);
            const data = Object.fromEntries(formData.entries());

            if (data.password.length < 4) {
                alert('La contraseña debe tener al menos 4 caracteres.');
                return;
            }

            try {
                const response = await fetch('/api/usuarios', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                if (response.ok) {
                    alert('¡Usuario creado con éxito!');
                    userForm.reset();
                    hideForm();
                    fetchUsers();
                } else {
                    alert(`Error al crear usuario: ${result.error}`);
                }
            } catch (error) {
                console.error('Error de red:', error);
                alert('Error de conexión con el servidor.');
            }
        });
    }

    // --- LÓGICA DE VISUALIZACIÓN DE USUARIOS ---
    const fetchUsers = async () => {
        if (!usersTbody) return;
        usersTbody.innerHTML = '<tr><td colspan="5" aria-busy="true">Cargando usuarios...</td></tr>';

        try {
            const response = await fetch('/api/usuarios', { headers: { 'Authorization': `Bearer ${token}` } });
            if (response.status === 401 || response.status === 403) { localStorage.removeItem('authToken'); window.location.href = '../login.html'; return; }
            const result = await response.json();
            usersTbody.innerHTML = '';

            if (response.ok && result.data.length > 0) {
                result.data.forEach(user => {
                    const tr = document.createElement('tr');
                    const isInactive = user.estado === 'inactivo';
                    const isAdmin = user.usuario === 'admin';

                    tr.innerHTML = `
                        <td><strong>${user.nombre}</strong></td>
                        <td>${user.usuario}</td>
                        <td>${user.rol}</td>
                        <td><mark class="${isInactive ? 'secondary' : ''}">${user.estado}</mark></td>
                        <td>
                            <div class="action-buttons">
                                <button class="outline ${isInactive ? 'js-activate-user' : 'js-deactivate-user'}" data-id="${user.id}" data-name="${user.nombre}" title="${isInactive ? 'Activar' : 'Desactivar'} Usuario" ${isAdmin ? 'disabled' : ''}>
                                    <i data-feather="${isInactive ? 'check-circle' : 'slash'}"></i>
                                </button>
                                <button class="outline secondary js-delete-user" data-id="${user.id}" data-name="${user.nombre}" title="Eliminar Usuario" ${isAdmin ? 'disabled' : ''}>
                                    <i data-feather="trash-2"></i>
                                </button>
                            </div>
                        </td>
                    `;
                    usersTbody.appendChild(tr);
                });
            } else {
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                td.colSpan = 5;
                td.style.textAlign = 'center';
                td.textContent = 'No hay otros usuarios registrados.';
                tr.appendChild(td);
                usersTbody.appendChild(tr);
            }
            feather.replace();
        } catch (error) { console.error('Error de conexión:', error); }
    };

    // --- MANEJO DE ACCIONES DE LA TABLA (ACTIVAR/DESACTIVAR, ELIMINAR) ---
    usersTbody.addEventListener('click', async (e) => {
        const activateBtn = e.target.closest('.js-activate-user');
        const deactivateBtn = e.target.closest('.js-deactivate-user');
        const deleteBtn = e.target.closest('.js-delete-user');

        const updateUserState = async (id, name, newState) => {
            if (confirm(`¿Estás seguro de que deseas ${newState === 'activo' ? 'activar' : 'desactivar'} al usuario "${name}"?`)) {
                try {
                    const response = await fetch(`/api/usuarios/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ estado: newState })
                    });
                    const result = await response.json();
                    if (response.ok) {
                        alert(result.message);
                        fetchUsers();
                    } else { throw new Error(result.error); }
                } catch (error) { alert(`Error al actualizar estado: ${error.message}`); }
            }
        };

        if (activateBtn) {
            updateUserState(activateBtn.dataset.id, activateBtn.dataset.name, 'activo');
        }

        if (deactivateBtn) {
            updateUserState(deactivateBtn.dataset.id, deactivateBtn.dataset.name, 'inactivo');
        }

        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            const name = deleteBtn.dataset.name;
            if (confirm(`¡ADVERTENCIA!\n¿Estás seguro de que deseas ELIMINAR PERMANENTEMENTE al usuario "${name}"?\nEsta acción no se puede deshacer.`)) {
                try {
                    const response = await fetch(`/api/usuarios/${id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const result = await response.json();
                    if (response.ok) {
                        alert(result.message);
                        fetchUsers();
                    } else { throw new Error(result.error); }
                } catch (error) { alert(`Error al eliminar: ${error.message}`); }
            }
        }
    });

    const setCacheBustedLogo = () => {
        const logos = document.querySelectorAll('.sidebar-logo');
        logos.forEach(logo => {
            // La ruta cambia a 2 niveles arriba para los archivos en /html/
            logo.src = `../img/logo.png?v=${new Date().getTime()}`;
        });
    };

    // --- INICIALIZACIÓN ---
    fetchUsers();
});