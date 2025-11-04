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
    
    const providerForm = document.getElementById('provider-form');
    const providersTbody = document.getElementById('providers-tbody');
    const formTitle = document.querySelector('#form-section h2');
    const formSubmitButton = document.querySelector('#provider-form button[type="submit"]');

    let editingProviderId = null;

    // --- LÓGICA DE LA INTERFAZ PRINCIPAL ---
    const showForm = (isEditing = false) => {
        if (isEditing) {
            formTitle.textContent = 'Editar Proveedor';
            formSubmitButton.textContent = 'Guardar Cambios';
        } else {
            editingProviderId = null;
            formTitle.textContent = 'Añadir Nuevo Proveedor';
            formSubmitButton.textContent = 'Guardar Proveedor';
            providerForm.reset();
        }
        body.classList.add('form-active');
    };
    const hideForm = () => {
        body.classList.remove('form-active');
        providerForm.reset();
        editingProviderId = null;
    };
    showFormButtons.forEach(btn => btn.addEventListener('click', () => showForm(false)));
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

    // --- LÓGICA DEL FORMULARIO (CREAR Y EDITAR) ---
    if (providerForm) {
        providerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(providerForm);
            const data = Object.fromEntries(formData.entries());

            const isEditing = editingProviderId !== null;
            const url = isEditing ? `/api/proveedores/${editingProviderId}` : '/api/proveedores';
            const method = isEditing ? 'PUT' : 'POST';

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(data)
                });
                const result = await response.json();

                if (response.ok) {
                    alert(`¡Proveedor ${isEditing ? 'actualizado' : 'añadido'} con éxito!`);
                    hideForm();
                    fetchProviders();
                } else {
                    alert(`Error: ${result.error}`);
                }
            } catch (error) {
                console.error('Error de red:', error);
                alert('Error de conexión con el servidor.');
            }
        });
    }

    // --- LÓGICA DE VISUALIZACIÓN DE PROVEEDORES ---
    const fetchProviders = async () => {
        if (!providersTbody) return;
        providersTbody.innerHTML = '<tr><td colspan="5" aria-busy="true">Cargando proveedores...</td></tr>';

        try {
            const response = await fetch('/api/proveedores', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('authToken');
                window.location.href = '../login.html';
                return;
            }

            const result = await response.json();
            providersTbody.innerHTML = '';

            if (response.ok && result.data.length > 0) {
                result.data.forEach(provider => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${provider.nombre}</strong></td>
                        <td>${provider.contacto || 'N/A'}</td>
                        <td>${provider.telefono || 'N/A'}</td>
                        <td>${provider.email || 'N/A'}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="outline js-edit-provider" data-id="${provider.id}" title="Editar Proveedor"><i data-feather="edit-2"></i></button>
                                <button class="outline secondary js-delete-provider" data-id="${provider.id}" title="Eliminar Proveedor"><i data-feather="trash-2"></i></button>
                            </div>
                        </td>
                    `;
                    providersTbody.appendChild(tr);
                });
            } else {
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                td.colSpan = 5;
                td.style.textAlign = 'center';
                td.textContent = 'No hay proveedores registrados. ¡Añade uno para empezar!';
                tr.appendChild(td);
                providersTbody.appendChild(tr);
            }
            feather.replace();
        } catch (error) {
            console.error('Error de conexión:', error);
        }
    };

    // --- MANEJO DE ACCIONES DE LA TABLA (EDITAR Y ELIMINAR) ---
    providersTbody.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.js-edit-provider');
        const deleteBtn = e.target.closest('.js-delete-provider');

        if (editBtn) {
            const id = editBtn.dataset.id;
            try {
                const response = await fetch(`/api/proveedores/${id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const result = await response.json();
                if (response.ok) {
                    for (const key in result.data) {
                        if(providerForm.elements[key]) {
                            providerForm.elements[key].value = result.data[key] || '';
                        }
                    }
                    editingProviderId = id;
                    showForm(true);
                } else {
                    alert(`Error al cargar datos del proveedor: ${result.error}`);
                }
            } catch (error) {
                alert('Error de conexión al cargar datos del proveedor.');
            }
        }

        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            const providerName = deleteBtn.closest('tr').querySelector('strong').textContent;
            
            if (confirm(`¿Estás seguro de que deseas eliminar al proveedor "${providerName}"?\nEsta acción no se puede deshacer.`)) {
                try {
                    const response = await fetch(`/api/proveedores/${id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const result = await response.json();
                    if (response.ok) {
                        alert(result.message);
                        fetchProviders();
                    } else {
                        alert(`Error al eliminar: ${result.error}`);
                    }
                } catch (error) {
                    alert('Error de conexión al eliminar el proveedor.');
                }
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
    fetchProviders();
});