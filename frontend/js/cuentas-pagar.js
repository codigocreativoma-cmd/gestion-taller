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
    const htmlElement = document.documentElement;
    const logoutBtn = document.getElementById('logout-btn');

    const showFormButtons = document.querySelectorAll('.js-show-form');
    const hideFormButtons = document.querySelectorAll('.js-hide-form');
    
    const accountForm = document.getElementById('account-form');
    const accountsTablesContainer = document.getElementById('accounts-tables-container');
    const proveedorSelect = document.getElementById('proveedor-select');
    
    const paymentModal = document.getElementById('payment-modal');
    const paymentForm = document.getElementById('payment-form');
    const paymentProviderName = document.getElementById('payment-provider-name');
    const saldoPendienteInfo = document.getElementById('saldo-pendiente-info');
    
    const historyModal = document.getElementById('history-modal');
    const historyFacturaInfo = document.getElementById('history-factura-info');
    const paymentHistoryContent = document.getElementById('payment-history-content');
    
    const allCloseButtons = document.querySelectorAll('.js-close-modal');
    const filterTabs = document.querySelectorAll('.filter-tabs a');

    let currentAccountId = null;
    let activeFilter = 'pendientes';

    // --- LÓGICA DE LA INTERFAZ PRINCIPAL ---
    const showForm = () => body.classList.add('form-active');
    const hideForm = () => body.classList.remove('form-active');
    showFormButtons.forEach(btn => btn.addEventListener('click', showForm));
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
            themeToggle.innerHTML = '';
            themeToggle.appendChild(newIcon);
        }
        feather.replace();
    };
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const newTheme = htmlElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            localStorage.setItem('theme', newTheme);
            applyTheme(newTheme);
        });
    }
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('authToken');
            localStorage.removeItem('userRole'); // Clear role on logout
            window.location.href = '../login.html';
        });
    }

    // --- LÓGICA DEL FORMULARIO DE NUEVA CUENTA ---
    if (accountForm) {
        accountForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(accountForm);
            const data = Object.fromEntries(formData.entries());
            try {
                const response = await fetch('/api/cuentas-pagar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                if (response.ok) {
                    alert('¡Cuenta por pagar registrada con éxito!');
                    accountForm.reset();
                    hideForm();
                    fetchData(activeFilter);
                } else {
                    alert(`Error al registrar la cuenta: ${result.error}`);
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
                proveedorSelect.innerHTML = '<option value="">Seleccione un proveedor...</option>';
                result.data.forEach(provider => {
                    const option = document.createElement('option');
                    option.value = provider.id;
                    option.textContent = provider.nombre;
                    proveedorSelect.appendChild(option);
                });
            }
        } catch (error) { console.error('Error al cargar proveedores:', error); }
    };

    const fetchData = async (filtro) => {
        if (!accountsTablesContainer) return;
        accountsTablesContainer.innerHTML = '<div aria-busy="true">Cargando...</div>';
        try {
            const response = await fetch(`/api/cuentas-pagar?filtro=${filtro}`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (response.status === 401 || response.status === 403) { localStorage.removeItem('authToken'); window.location.href = '../login.html'; return; }
            const result = await response.json();
            
            if (filtro === 'pendientes') {
                renderPendientesTable(result.data);
            } else if (filtro === 'pagadas') {
                renderPagadasTable(result.data);
            }
            feather.replace();
        } catch (error) { 
            console.error('Error de conexión:', error); 
            accountsTablesContainer.innerHTML = `<p style="color:var(--pico-color-red-500)">Error al cargar los datos.</p>`;
        }
    };

    // --- FUNCIONES DE RENDERIZADO DE TABLAS ---
    const renderPendientesTable = (data) => {
        let tableHtml = `<table><thead><tr><th>Proveedor</th><th>Saldo</th><th>Saldo c/ Descuento</th><th class="desktop-only">Vencimiento</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>`;
        if (data && data.length > 0) {
            data.forEach(account => {
                const montoTotal = account.monto_total;
                const montoPagado = account.monto_pagado || 0;
                const saldo = montoTotal - montoPagado;
                let saldoConDescuento = saldo;
                const hoy = new Date().toISOString().split('T')[0];
                const aplicaDescuento = account.fecha_vencimiento && hoy <= account.fecha_vencimiento && account.descuento_pronto_pago > 0;
                if (aplicaDescuento) {
                    const montoConDescuentoTotal = montoTotal * (1 - account.descuento_pronto_pago / 100);
                    saldoConDescuento = montoConDescuentoTotal - montoPagado;
                }
                const fechaVencimiento = account.fecha_vencimiento ? new Date(account.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-CO') : 'N/A';
                tableHtml += `<tr>
                    <td><strong>${account.proveedor_nombre || 'N/A'}</strong></td>
                    <td>${saldo.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</td>
                    <td class="saldo-descuento">${aplicaDescuento && saldoConDescuento < saldo ? saldoConDescuento.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }) : 'N/A'}</td>
                    <td class="desktop-only">${fechaVencimiento}</td>
                    <td><mark class="${account.estado === 'abonado' ? 'secondary' : ''}">${account.estado}</mark></td>
                    <td><div class="action-buttons">
                        <button class="outline js-register-payment" data-id="${account.id}" data-saldo="${saldo}" data-saldo-descuento="${saldoConDescuento}" data-aplica-descuento="${aplicaDescuento}" data-provider="${account.proveedor_nombre || 'N/A'}" title="Registrar Pago/Abono"><i data-feather="dollar-sign"></i></button>
                        <button class="outline js-view-history" data-id="${account.id}" data-factura="${account.numero_factura || `ID ${account.id}`}" title="Ver Historial de Pagos"><i data-feather="eye"></i></button>
                    </div></td></tr>`;
            });
        } else {
            tableHtml += '<tr><td colspan="6" style="text-align:center;">No hay cuentas pendientes de pago.</td></tr>';
        }
        tableHtml += `</tbody></table>`;
        accountsTablesContainer.innerHTML = tableHtml;
    };

    const renderPagadasTable = (data) => {
        let tableHtml = `<table><thead><tr><th>Proveedor</th><th>Total Pagado</th><th class="desktop-only">Fecha Creación</th><th>Fecha Pago Final</th><th>Acciones</th></tr></thead><tbody>`;
        if (data && data.length > 0) {
            const groupedByMonth = data.reduce((acc, account) => {
                const pagoDate = new Date(account.fecha_pago_final.replace(' ', 'T') + 'Z');
                const monthYear = pagoDate.toLocaleString('es-CO', { month: 'long', year: 'numeric' });
                if (!acc[monthYear]) acc[monthYear] = [];
                acc[monthYear].push(account);
                return acc;
            }, {});

            for (const month in groupedByMonth) {
                tableHtml += `<tr><td colspan="5" class="month-header">${month.charAt(0).toUpperCase() + month.slice(1)}</td></tr>`;
                groupedByMonth[month].forEach(account => {
                    const fechaCreacion = account.fecha_emision ? new Date(account.fecha_emision + 'T00:00:00').toLocaleDateString('es-CO') : 'N/A';
                    const fechaPago = new Date(account.fecha_pago_final.replace(' ', 'T') + 'Z').toLocaleDateString('es-CO');
                    tableHtml += `<tr>
                        <td><strong>${account.proveedor_nombre || 'N/A'}</strong> (${account.numero_factura || `ID ${account.id}`})</td>
                        <td>${account.monto_total.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</td>
                        <td class="desktop-only">${fechaCreacion}</td>
                        <td>${fechaPago}</td>
                        <td><div class="action-buttons"><button class="outline js-view-history" data-id="${account.id}" data-factura="${account.numero_factura || `ID ${account.id}`}" title="Ver Historial de Pagos"><i data-feather="eye"></i></button></div></td>
                    </tr>`;
                });
            }
        } else {
            tableHtml += '<tr><td colspan="5" style="text-align:center;">No hay cuentas pagadas registradas.</td></tr>';
        }
        tableHtml += `</tbody></table>`;
        accountsTablesContainer.innerHTML = tableHtml;
    };

    // --- MANEJO DE ACCIONES Y MODALES ---
    accountsTablesContainer.addEventListener('click', async (e) => {
        const paymentBtn = e.target.closest('.js-register-payment');
        const historyBtn = e.target.closest('.js-view-history');

        if (paymentBtn) {
            currentAccountId = paymentBtn.dataset.id;
            const saldo = parseFloat(paymentBtn.dataset.saldo);
            const saldoDescuento = parseFloat(paymentBtn.dataset.saldoDescuento);
            const aplicaDescuento = paymentBtn.dataset.aplicaDescuento === 'true';
            if (paymentProviderName) paymentProviderName.textContent = paymentBtn.dataset.provider;
            if (saldoPendienteInfo) {
                let infoHtml = `Saldo pendiente: <strong>${saldo.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</strong>`;
                if (aplicaDescuento) { infoHtml += `<br><small>Paga <strong>${saldoDescuento.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</strong> para liquidar con descuento.</small>`; }
                saldoPendienteInfo.innerHTML = infoHtml;
            }
            if (paymentForm) {
                paymentForm.reset();
                const montoSugerido = aplicaDescuento ? saldoDescuento : saldo;
                paymentForm.elements['monto_abono'].value = montoSugerido > 0 ? montoSugerido.toFixed(2) : '0.00';
            }
            if (paymentModal) paymentModal.showModal();
        }
        if (historyBtn) {
            const cuentaId = historyBtn.dataset.id;
            if(historyFacturaInfo) historyFacturaInfo.textContent = `#${historyBtn.dataset.factura}`;
            if(paymentHistoryContent) paymentHistoryContent.innerHTML = '<div aria-busy="true">Cargando historial...</div>';
            if(historyModal) historyModal.showModal();
            try {
                const response = await fetch(`/api/cuentas-pagar/${cuentaId}/pagos`, { headers: { 'Authorization': `Bearer ${token}` } });
                const result = await response.json();
                if (response.ok) {
                    let tableHtml = `<table><thead><tr><th>Fecha</th><th>Monto Pagado</th><th>Descuento</th><th>Método</th></tr></thead><tbody>`;
                    if (result.data.length > 0) {
                        result.data.forEach(pago => {
                            const fechaFormateada = new Date(pago.fecha_pago.replace(' ', 'T') + 'Z').toLocaleString('es-CO');
                            tableHtml += `
                                <tr>
                                    <td>${fechaFormateada}</td>
                                    <td>${pago.monto.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</td>
                                    <td>${(pago.descuento || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</td>
                                    <td>${pago.metodo_pago || 'N/A'}</td>
                                </tr>`;
                        });
                    } else {
                        tableHtml += `<tr><td colspan="4" style="text-align:center;">No hay pagos registrados.</td></tr>`;
                    }
                    tableHtml += `</tbody></table>`;
                    if(paymentHistoryContent) paymentHistoryContent.innerHTML = tableHtml;
                } else { throw new Error(result.error); }
            } catch (error) {
                if(paymentHistoryContent) paymentHistoryContent.innerHTML = `<p style="color:var(--pico-color-red-500)">Error al cargar el historial: ${error.message}</p>`;
            }
        }
    });

    allCloseButtons.forEach(btn => btn.addEventListener('click', () => {
        if(paymentModal) paymentModal.close();
        if(historyModal) historyModal.close();
    }));

    if (paymentForm) {
        paymentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentAccountId) return;
            const formData = new FormData(paymentForm);
            const data = Object.fromEntries(formData.entries());
            try {
                const response = await fetch(`/api/cuentas-pagar/${currentAccountId}/pagos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                if (response.ok) {
                    alert(result.message);
                    paymentModal.close();
                    fetchData(activeFilter);
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                alert(`Error al registrar el pago: ${error.message}`);
            }
        });
    }
    
    filterTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeFilter = tab.dataset.filter;
            fetchData(activeFilter);
        });
    });

    const setCacheBustedLogo = () => {
        const logos = document.querySelectorAll('.sidebar-logo');
        logos.forEach(logo => {
            // La ruta cambia a 2 niveles arriba para los archivos en /html/
            logo.src = `../img/logo.png?v=${new Date().getTime()}`;
        });
    };

    // --- INICIALIZACIÓN ---
    applyTheme(localStorage.getItem('theme') || 'light');
    fetchData(activeFilter);
    loadProviders();
});