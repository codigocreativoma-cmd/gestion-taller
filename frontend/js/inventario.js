document.addEventListener('DOMContentLoaded', () => {
    // --- LÓGICA DE SEGURIDAD Y ROLES ---
    const token = localStorage.getItem('authToken');
    const userRole = localStorage.getItem('userRole');
    if (!token) {
        window.location.href = '../login.html'; // Adjust path for subfolder
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
    const htmlElement = document.documentElement;
    const logoutBtn = document.getElementById('logout-btn');

    const showFormButtons = document.querySelectorAll('.js-show-form');
    const hideFormButtons = document.querySelectorAll('.js-hide-form');
    
    const productForm = document.getElementById('product-form');
    const inventoryTbody = document.getElementById('inventory-tbody');
    const proveedorSelect = document.getElementById('proveedor-select');
    
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const paginationInfo = document.getElementById('pagination-info');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    
    const stockModal = document.getElementById('stock-locations-modal');
    const closeStockModalBtn = document.getElementById('close-stock-modal');
    const stockProductName = document.getElementById('stock-product-name');
    const stockLocationsContent = document.getElementById('stock-locations-content');

    const formTitle = document.querySelector('#form-section h2');
    const formSubmitButton = document.querySelector('#product-form button[type="submit"]');
    
    const addStockModal = document.getElementById('add-stock-modal');
    const addStockForm = document.getElementById('add-stock-form');
    const addStockProductName = document.getElementById('add-stock-product-name');
    const allCloseButtons = document.querySelectorAll('.js-close-modal');

    let paginaActual = 1;
    let totalPaginas = 1;
    let terminoBusqueda = '';
    let editingProductId = null;
    let currentProductIdForStock = null;

    // --- LÓGICA DE LA INTERFAZ PRINCIPAL ---
    const showForm = (isEditing = false) => {
        const stockSection = document.getElementById('stock-inicial-section');
        if (stockSection) {
            stockSection.classList.toggle('hidden', isEditing);
        }
        if (isEditing) {
            formTitle.textContent = 'Editar Producto del Catálogo';
            formSubmitButton.textContent = 'Guardar Cambios';
        } else {
            editingProductId = null;
            formTitle.textContent = 'Añadir Nuevo Producto al Catálogo';
            formSubmitButton.textContent = 'Guardar Producto';
            productForm.reset();
        }
        body.classList.add('form-active');
    };
    const hideForm = () => {
        body.classList.remove('form-active');
        productForm.reset();
        editingProductId = null;
    };
    showFormButtons.forEach(btn => btn.addEventListener('click', () => showForm(false)));
    hideFormButtons.forEach(btn => btn.addEventListener('click', hideForm));

    // --- LÓGICA DEL PANEL (UI) ---
    const toggleMenu = () => { sidebar.classList.toggle('is-open'); overlay.classList.toggle('is-visible'); };
    if (hamburgerMenu) hamburgerMenu.addEventListener('click', toggleMenu);
    if (overlay) overlay.addEventListener('click', toggleMenu);
    const applyTheme = (theme) => {
        htmlElement.setAttribute('data-theme', theme);
        if (themeToggle) {
            const newIcon = document.createElement('i');
            newIcon.setAttribute('data-feather', theme === 'dark' ? 'sun' : 'moon');
            themeToggle.innerHTML = ''; themeToggle.appendChild(newIcon);
        }
        feather.replace();
    };
    if (themeToggle) { themeToggle.addEventListener('click', () => { const newTheme = htmlElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; localStorage.setItem('theme', newTheme); applyTheme(newTheme); }); }
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('authToken');
            localStorage.removeItem('userRole'); // Clear role on logout
            window.location.href = '../login.html';
        });
    }

    // --- LÓGICA DEL FORMULARIO (CREAR Y EDITAR PRODUCTO) ---
    if (productForm) {
        productForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(productForm);
            const data = Object.fromEntries(formData.entries());
            const isEditing = editingProductId !== null;
            const url = isEditing ? `/api/productos/${editingProductId}` : '/api/inventario';
            const method = isEditing ? 'PUT' : 'POST';
            try {
                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                if (response.ok) {
                    alert(`¡Producto ${isEditing ? 'actualizado' : 'añadido'} con éxito!`);
                    hideForm();
                    fetchInventory(paginaActual, terminoBusqueda);
                } else {
                    alert(`Error: ${result.error}`);
                }
            } catch (error) {
                console.error('Error de red:', error);
                alert('Error de conexión con el servidor.');
            }
        });
    }

    // --- LÓGICA DE CARGA DE DATOS ---
    const loadProviders = async () => {
        if (!proveedorSelect) return;
        try {
            const response = await fetch('/api/proveedores', { headers: { 'Authorization': `Bearer ${token}` } });
            const result = await response.json();
            if (response.ok) {
                proveedorSelect.innerHTML = '<option value="">Ninguno</option>';
                result.data.forEach(provider => {
                    const option = document.createElement('option');
                    option.value = provider.id;
                    option.textContent = provider.nombre;
                    proveedorSelect.appendChild(option);
                });
            }
        } catch (error) { console.error('Error al cargar proveedores:', error); }
    };
    
    const fetchInventory = async (pagina = 1, buscar = '') => {
        if (!inventoryTbody) return;
        inventoryTbody.innerHTML = '<tr><td colspan="6" aria-busy="true">Cargando inventario...</td></tr>';
        try {
            const response = await fetch(`/api/inventario?pagina=${pagina}&buscar=${encodeURIComponent(buscar)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.status === 401 || response.status === 403) { localStorage.removeItem('authToken'); window.location.href = '../login.html'; return; }
            const result = await response.json();
            inventoryTbody.innerHTML = '';
            if (response.ok && result.data.length > 0) {
                result.data.forEach(item => {
                    const tr = document.createElement('tr');
                    const stockClass = item.cantidad_total <= 0 ? 'stock-low' : 'stock-ok';
                    const precioVenta = item.precio_venta.toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
                    tr.innerHTML = `
                        <td>${item.id}</td>
                        <td><strong>${item.nombre}</strong></td>
                        <td class="${stockClass}">${item.cantidad_total}</td>
                        <td>${precioVenta}</td>
                        <td class="desktop-only">${item.proveedor_nombre || 'N/A'}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="outline js-add-stock" data-id="${item.id}" data-name="${item.nombre}" title="Añadir Stock"><i data-feather="plus-square"></i></button>
                                <button class="outline js-view-stock" data-id="${item.id}" data-name="${item.nombre}" title="Ver Ubicaciones"><i data-feather="eye"></i></button>
                                <button class="outline js-edit-product" data-id="${item.id}" title="Editar Producto"><i data-feather="edit-2"></i></button>
                                <button class="outline secondary js-delete-product" data-id="${item.id}" data-name="${item.nombre}" title="Eliminar Producto"><i data-feather="trash-2"></i></button>
                            </div>
                        </td>`;
                    inventoryTbody.appendChild(tr);
                });
            } else {
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                td.colSpan = 6;
                td.style.textAlign = 'center';
                td.textContent = 'No se encontraron productos. ¡Añade uno para empezar o ajusta tu búsqueda!';
                tr.appendChild(td);
                inventoryTbody.appendChild(tr);
            }
            updatePagination(result.pagination);
            feather.replace();
        } catch (error) { console.error('Error de conexión:', error); }
    };
    
    const updatePagination = (pagination) => {
        if (!pagination) return;
        paginaActual = pagination.paginaActual;
        totalPaginas = pagination.totalPaginas;
        paginationInfo.textContent = `Página ${paginaActual} de ${totalPaginas} (${pagination.totalProductos} productos)`;
        prevPageBtn.disabled = paginaActual <= 1;
        nextPageBtn.disabled = paginaActual >= totalPaginas;
    };
    
    const showStockLocations = async (productId, productName) => {
        stockProductName.textContent = productName;
        stockLocationsContent.innerHTML = '<div aria-busy="true">Cargando ubicaciones...</div>';
        stockModal.showModal();
        try {
            const response = await fetch(`/api/productos/${productId}/stock`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            if (response.ok) {
                let tableHtml = `<table><thead><tr><th>Taller</th><th>Cantidad</th><th>Stock Mínimo</th></tr></thead><tbody>`;
                if (result.data.length > 0) {
                    result.data.forEach(stock => {
                        tableHtml += `<tr><td>${stock.taller}</td><td>${stock.cantidad}</td><td>${stock.stock_minimo}</td></tr>`;
                    });
                } else {
                    tableHtml += '<tr><td colspan="3" style="text-align:center;">Este producto no tiene stock registrado en ningún taller.</td></tr>';
                }
                tableHtml += '</tbody></table>';
                stockLocationsContent.innerHTML = tableHtml;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            stockLocationsContent.innerHTML = `<p style="color:var(--pico-color-red-500)">Error al cargar las ubicaciones: ${error.message}</p>`;
        }
    };
    
    searchForm.addEventListener('submit', (e) => { e.preventDefault(); terminoBusqueda = searchInput.value; paginaActual = 1; fetchInventory(paginaActual, terminoBusqueda); });
    prevPageBtn.addEventListener('click', () => { if (paginaActual > 1) { fetchInventory(paginaActual - 1, terminoBusqueda); } });
    nextPageBtn.addEventListener('click', () => { if (paginaActual < totalPaginas) { fetchInventory(paginaActual + 1, terminoBusqueda); } });
    
    inventoryTbody.addEventListener('click', async (e) => {
        const viewBtn = e.target.closest('.js-view-stock');
        const editBtn = e.target.closest('.js-edit-product');
        const deleteBtn = e.target.closest('.js-delete-product');
        const addStockBtn = e.target.closest('.js-add-stock');
        
        if (viewBtn) { showStockLocations(viewBtn.dataset.id, viewBtn.dataset.name); }
        if (editBtn) {
            const id = editBtn.dataset.id;
            try {
                const response = await fetch(`/api/productos/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
                const result = await response.json();
                if (response.ok) {
                    for (const key in result.data) { if (productForm.elements[key]) { productForm.elements[key].value = result.data[key] || ''; } }
                    editingProductId = id;
                    showForm(true);
                } else { alert(`Error: ${result.error}`); }
            } catch (error) { alert('Error de conexión al cargar el producto.'); }
        }
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            const name = deleteBtn.dataset.name;
            if (confirm(`¿Estás seguro de que deseas eliminar "${name}" del catálogo?\nEsta acción eliminará también todo su stock asociado en todos los talleres.`)) {
                try {
                    const response = await fetch(`/api/productos/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                    const result = await response.json();
                    if (response.ok) { alert(result.message); fetchInventory(paginaActual, terminoBusqueda); } else { alert(`Error: ${result.error}`); }
                } catch (error) { alert('Error de conexión al eliminar el producto.'); }
            }
        }
        if (addStockBtn) {
            currentProductIdForStock = addStockBtn.dataset.id;
            addStockProductName.textContent = addStockBtn.dataset.name;
            addStockForm.reset();
            addStockModal.showModal();
        }
    });
    
    allCloseButtons.forEach(btn => btn.addEventListener('click', () => {
        if(stockModal) stockModal.close();
        if(addStockModal) addStockModal.close();
    }));

    if(addStockForm) {
        addStockForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(addStockForm);
            const data = Object.fromEntries(formData.entries());
            data.producto_id = currentProductIdForStock;
    
            try {
                const response = await fetch('/api/stock/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                if (response.ok) {
                    alert(result.message);
                    addStockModal.close();
                    fetchInventory(paginaActual, terminoBusqueda);
                } else {
                    throw new Error(result.error);
                }
            } catch(error) {
                alert(`Error al añadir stock: ${error.message}`);
            }
        });
    }

    const setCacheBustedLogo = () => {
        const logos = document.querySelectorAll('.sidebar-logo');
        logos.forEach(logo => {
            // La ruta cambia a 2 niveles arriba para los archivos en /html/
            logo.src = `../img/logo.png?v=${new Date().getTime()}`;
        });
    };

    // --- INICIALIZACIÓN ---
    applyTheme(localStorage.getItem('theme') || 'light');
    fetchInventory();
    loadProviders();
});