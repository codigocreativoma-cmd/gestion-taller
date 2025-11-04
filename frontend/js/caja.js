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
    const sidebar = document.getElementById('sidebar');
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const overlay = document.getElementById('overlay');
    const logoutBtn = document.getElementById('logout-btn');
    const themeToggle = document.getElementById('theme-toggle');
    const themeToggleDesktop = document.getElementById('theme-toggle-desktop');
    const htmlElement = document.documentElement;

    const productSearchInput = document.getElementById('product-search-input');
    const productSearchResults = document.getElementById('product-search-results');

    const ticketItemsTbody = document.getElementById('ticket-items-tbody');
    const ticketEmptyMessage = document.getElementById('ticket-empty-message');
    const totalAmountSpan = document.getElementById('total-amount');
    const checkoutForm = document.getElementById('checkout-form');
    const processSaleBtn = document.getElementById('process-sale-btn');
    const clearTicketBtn = document.getElementById('clear-ticket-btn');

    const clienteNombreInput = document.getElementById('cliente-nombre');
    const clienteDocumentoInput = document.getElementById('cliente-documento');

    let currentTicket = [];

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

    // --- LÓGICA DE BÚSQUEDA DE PRODUCTOS ---
    productSearchInput.addEventListener('input', async (e) => {
        const searchTerm = e.target.value;
        if (searchTerm.length < 2) {
            productSearchResults.innerHTML = '';
            return;
        }
        try {
            const response = await fetch(`/api/inventario?buscar=${encodeURIComponent(searchTerm)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            productSearchResults.innerHTML = '';
            if (response.ok && result.data.length > 0) {
                result.data.forEach(item => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'list-item js-add-product';
                    itemDiv.dataset.product = JSON.stringify(item);
                    itemDiv.innerHTML = `
                        <div class="info">
                            <strong>${item.nombre}</strong>
                            <small>Stock: ${item.cantidad_total}</small>
                        </div>
                        <strong class="price">${item.precio_venta.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</strong>
                    `;
                    productSearchResults.appendChild(itemDiv);
                });
            } else {
                productSearchResults.innerHTML = '<p style="padding: 1rem; text-align: center;">No se encontraron productos.</p>';
            }
        } catch (error) {
            console.error('Error buscando en inventario:', error);
        }
    });

    // --- LÓGICA DEL TICKET DE VENTA ---
    const updateTicketView = () => {
        ticketItemsTbody.innerHTML = '';
        let total = 0;

        ticketEmptyMessage.style.display = currentTicket.length === 0 ? 'block' : 'none';
        processSaleBtn.disabled = currentTicket.length === 0;

        currentTicket.forEach((item, index) => {
            const itemSubtotal = item.cantidad * item.precio_unitario;
            total += itemSubtotal;
            const tr = document.createElement('tr');
            const isOrder = !!item.orden_id;

            const priceCellContent = isOrder
                ? item.precio_unitario.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })
                : `<input type="number" min="0" step="0.01" value="${item.precio_unitario}" class="js-update-price" data-index="${index}" style="width: 100px; height: auto; padding: 0.2rem;" />`;

            tr.innerHTML = `
                <td>${item.descripcion}</td>
                <td><input type="number" min="1" value="${item.cantidad}" class="js-update-qty" data-index="${index}" style="width: 60px; height: auto; padding: 0.2rem;" ${isOrder ? 'disabled' : ''} /></td>
                <td>${priceCellContent}</td>
                <td>${itemSubtotal.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</td>
                <td><button class="outline secondary small-btn js-remove-item" data-index="${index}"><i data-feather="trash-2"></i></button></td>
            `;
            ticketItemsTbody.appendChild(tr);
        });

        totalAmountSpan.textContent = total.toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
        feather.replace();
    };

    const addItemToTicket = (item) => {
        if (item.orden_id && currentTicket.some(i => i.orden_id)) {
            alert('Solo se puede procesar una orden de reparación por venta.');
            return;
        }
        
        if (item.orden_id && item.cliente_nombre) {
            clienteNombreInput.value = item.cliente_nombre;
        }

        const existingItem = currentTicket.find(i => i.producto_id === item.producto_id && item.producto_id !== null);
        if (existingItem) {
            existingItem.cantidad++;
        } else {
            currentTicket.push(item);
        }
        updateTicketView();
    };

    productSearchResults.addEventListener('click', (e) => {
        const productItem = e.target.closest('.js-add-product');
        if (productItem) {
            const productData = JSON.parse(productItem.dataset.product);
            addItemToTicket({
                orden_id: null,
                producto_id: productData.id,
                descripcion: productData.nombre,
                cantidad: 1,
                precio_unitario: productData.precio_venta,
                costo_unitario: productData.precio_costo || 0
            });
            productSearchInput.value = '';
            productSearchResults.innerHTML = '';
        }
    });
    
    ticketItemsTbody.addEventListener('click', (e) => {
        const removeItemBtn = e.target.closest('.js-remove-item');
        if (removeItemBtn) {
            const index = parseInt(removeItemBtn.dataset.index, 10);
            if (currentTicket[index].orden_id) {
                clienteNombreInput.value = '';
                clienteDocumentoInput.value = '';
            }
            currentTicket.splice(index, 1);
            updateTicketView();
        }
    });
    
    ticketItemsTbody.addEventListener('change', (e) => {
        const qtyInput = e.target.closest('.js-update-qty');
        const priceInput = e.target.closest('.js-update-price');

        if (qtyInput) {
            const index = parseInt(qtyInput.dataset.index, 10);
            const newQty = parseInt(qtyInput.value, 10);
            if (newQty > 0) {
                currentTicket[index].cantidad = newQty;
            } else {
                currentTicket.splice(index, 1);
            }
            updateTicketView();
        }
        if (priceInput) {
            const index = parseInt(priceInput.dataset.index, 10);
            const newPrice = parseFloat(priceInput.value);
            if (!isNaN(newPrice) && newPrice >= 0) {
                currentTicket[index].precio_unitario = newPrice;
            } else {
                priceInput.value = currentTicket[index].precio_unitario;
            }
            updateTicketView();
        }
    });

    clearTicketBtn.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que deseas limpiar el ticket actual?')) {
            currentTicket = [];
            clienteNombreInput.value = '';
            clienteDocumentoInput.value = '';
            updateTicketView();
        }
    });

    // --- PROCESAMIENTO DE LA VENTA ---
    checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        processSaleBtn.setAttribute('aria-busy', 'true');
        processSaleBtn.disabled = true;

        const total = currentTicket.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0);
        const orderInTicket = currentTicket.find(item => item.orden_id);

        const ventaData = {
            orden_id: orderInTicket ? orderInTicket.orden_id : null,
            cliente_nombre: clienteNombreInput.value.trim() || 'Venta General',
            cliente_documento: clienteDocumentoInput.value.trim(),
            total: total,
            metodo_pago: document.getElementById('metodo-pago').value,
            taller: document.getElementById('taller-select').value,
            items: currentTicket.map(item => ({
                producto_id: item.producto_id,
                descripcion: item.descripcion,
                cantidad: item.cantidad,
                precio_unitario: item.precio_unitario,
                costo_unitario: item.costo_unitario || 0,
                subtotal: item.cantidad * item.precio_unitario
            }))
        };
        
        try {
            const response = await fetch('/api/ventas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(ventaData)
            });
            const result = await response.json();
            if (response.ok) {
                window.open(`factura.html?id=${result.data.ventaId}`, '_blank');
                currentTicket = [];
                checkoutForm.reset();
                updateTicketView();
            } else {
                throw new Error(result.error);
            }
        } catch(error) {
            alert(`Error al procesar la venta: ${error.message}`);
        } finally {
            processSaleBtn.removeAttribute('aria-busy');
            processSaleBtn.disabled = currentTicket.length === 0;
        }
    });

    const setCacheBustedLogo = () => {
        const logos = document.querySelectorAll('.sidebar-logo');
        logos.forEach(logo => {
            // La ruta cambia a 2 niveles arriba para los archivos en /html/
            logo.src = `../img/logo.png?v=${new Date().getTime()}`;
        });
    };
    
    // --- LÓGICA DE INICIALIZACIÓN ---
    const initializePage = () => {
        const pendingItemJSON = sessionStorage.getItem('pendingSaleItem');
        if (pendingItemJSON) {
            try {
                const pendingItem = JSON.parse(pendingItemJSON);
                addItemToTicket(pendingItem);
                sessionStorage.removeItem('pendingSaleItem');
            } catch (error) {
                console.error('Error al procesar el item de venta pendiente:', error);
                sessionStorage.removeItem('pendingSaleItem');
            }
        }
        updateTicketView();
    };

    initializePage();
});