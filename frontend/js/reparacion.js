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
    const ordenIdTitulo = document.getElementById('orden-id-titulo');
    const infoSection = document.getElementById('info-section');
    const reparacionForm = document.getElementById('reparacion-form');
    const guardarCambiosBtn = document.getElementById('guardar-cambios-btn');
    const sendToCashierBtn = document.getElementById('send-to-cashier-btn');
    
    const estadoSelect = document.getElementById('estado-select');
    const diagnosticoTextarea = document.getElementById('diagnostico-tecnico');
    const precioFinalInput = document.getElementById('precio-final');
    
    const usedPartsTbody = document.getElementById('used-parts-tbody');
    const totalCostSpan = document.getElementById('total-cost-span');
    const addFromInventoryBtn = document.getElementById('add-from-inventory-btn');
    const addManualPartBtn = document.getElementById('add-manual-part-btn');

    const inventoryModal = document.getElementById('inventory-modal');
    const manualPartModal = document.getElementById('manual-part-modal');
    const evidenceModal = document.getElementById('evidence-modal');
    const patternViewModal = document.getElementById('pattern-view-modal');
    
    const closeButtons = document.querySelectorAll('.js-close-modal');
    const inventorySearchInput = document.getElementById('inventory-search-input');
    const inventorySearchResults = document.getElementById('inventory-search-results');
    const manualPartForm = document.getElementById('manual-part-form');
    const evidenceModalGallery = document.getElementById('evidence-modal-gallery');
    
    const patternViewGrid = document.getElementById('pattern-view-grid');
    const patternViewCanvas = document.getElementById('pattern-view-canvas');

    let currentOrderId = null;
    let currentOrderData = null;
    let usedParts = [];

    // --- LÓGICA DEL PANEL (UI) ---
    const toggleMenu = () => { sidebar.classList.toggle('is-open'); overlay.classList.toggle('is-visible'); };
    if (hamburgerMenu) hamburgerMenu.addEventListener('click', toggleMenu);
    if (overlay) overlay.addEventListener('click', toggleMenu);
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('authToken');
            localStorage.removeItem('userRole'); // Clear role on logout
            window.location.href = '../login.html';
        });
    }

    // --- LÓGICA PRINCIPAL DE CARGA DE DATOS ---
    const loadOrderData = async () => {
        const params = new URLSearchParams(window.location.search);
        currentOrderId = params.get('id');

        if (!currentOrderId) {
            infoSection.innerHTML = '<h2>Error: No se ha especificado un ID de orden.</h2>';
            return;
        }
        ordenIdTitulo.textContent = String(currentOrderId).padStart(5, '0');

        try {
            const response = await fetch(`/api/ordenes/${currentOrderId}`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('La orden no fue encontrada o no tienes permiso para verla.');
            const result = await response.json();
            currentOrderData = result.data;
            populateView(currentOrderData);
            feather.replace();
        } catch (error) {
            console.error('Error al cargar la orden:', error);
            infoSection.innerHTML = `<h2>Error al cargar la orden: ${error.message}</h2>`;
        }
    };

    // --- LÓGICA DE POBLACIÓN DE VISTAS ---
    const populateView = (data) => {
        const equipo = `${data.equipo_marca || ''} ${data.equipo_modelo || ''}`.trim() || 'N/A';
        let detalles = 'Ninguno';
        if (data.detalles_esteticos) {
            try {
                const parsedDetails = JSON.parse(data.detalles_esteticos);
                if (Array.isArray(parsedDetails) && parsedDetails.length > 0) {
                    detalles = parsedDetails.join(', ');
                }
                if (data.otro_detalle) {
                    detalles = detalles === 'Ninguno' ? data.otro_detalle : `${detalles}, ${data.otro_detalle}`;
                }
            } catch (e) { 
                detalles = data.otro_detalle || 'Ninguno';
            }
        } else if (data.otro_detalle) {
            detalles = data.otro_detalle;
        }
        
        let unlockInfoHtml = `<span>${data.desbloqueo || 'N/A'}</span>`;
        if (data.desbloqueo && data.desbloqueo.includes('-')) {
            unlockInfoHtml += ` <button type="button" class="outline small-btn js-view-pattern" data-pattern="${data.desbloqueo}">Ver Patrón</button>`;
        }

        infoSection.innerHTML = `
            <h5><i data-feather="user"></i> Información del Cliente</h5>
            <ul>
                <li><strong>Nombre:</strong> <span>${data.cliente_nombre || 'N/A'}</span></li>
                <li><strong>Teléfono:</strong> <span>${data.cliente_telefono || 'N/A'}</span></li>
                <li><strong>Email:</strong> <span>${data.cliente_email || 'N/A'}</span></li>
            </ul>
            <h5><i data-feather="smartphone"></i> Información del Equipo</h5>
            <ul>
                <li><strong>Equipo:</strong> <span>${equipo}</span></li>
                <li><strong>IMEI/Serial:</strong> <span>${data.imei_serial || 'N/A'}</span></li>
                <li><strong>Desbloqueo:</strong> ${unlockInfoHtml}</li>
                <li><strong>Falla Reportada:</strong> <span>${data.falla_reportada || 'N/A'}</span></li>
                <li><strong>Detalles Estéticos:</strong> <span>${detalles}</span></li>
                <li><strong>Accesorios:</strong> <span>${data.accesorios || 'N/A'}</span></li>
            </ul>
        `;
        infoSection.removeAttribute('aria-busy');
        
        if (data.fotos && data.fotos.length > 0 && data.fotos[0] !== null) {
            const evidenceButton = document.createElement('button');
            evidenceButton.id = 'view-evidence-btn';
            evidenceButton.className = 'outline view-evidence-btn';
            evidenceButton.innerHTML = '<i data-feather="camera"></i> Ver Evidencia Fotográfica';
            infoSection.appendChild(evidenceButton);
        }

        estadoSelect.value = data.estado || 'Recibido';
        diagnosticoTextarea.value = data.diagnostico_tecnico || '';
        precioFinalInput.value = data.precio_final || '';
        
        try { usedParts = JSON.parse(data.repuestos_utilizados || '[]'); } catch (e) { usedParts = []; console.error("Error al parsear repuestos:", e); }
        renderUsedParts();
        updateSendToCashierButtonVisibility();
    };

    // --- LÓGICA DE GESTIÓN DE REPUESTOS ---
    const renderUsedParts = () => {
        usedPartsTbody.innerHTML = '';
        let totalCost = 0;
        usedParts.forEach((part, index) => {
            const cost = parseFloat(part.costo) || 0;
            totalCost += cost;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${part.nombre}</td>
                <td>${cost.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</td>
                <td><button type="button" class="outline secondary delete-part-btn" data-index="${index}" title="Eliminar"><i data-feather="x-circle"></i></button></td>
            `;
            usedPartsTbody.appendChild(tr);
        });
        totalCostSpan.textContent = totalCost.toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
        feather.replace();
    };
    const addPartToList = (part) => {
        usedParts.push(part);
        renderUsedParts();
    };
    
    // --- LÓGICA DE LAS MODALES ---
    addFromInventoryBtn.addEventListener('click', () => {
        inventorySearchInput.value = '';
        inventorySearchResults.innerHTML = '';
        inventoryModal.showModal();
    });
    addManualPartBtn.addEventListener('click', () => {
        manualPartForm.reset();
        manualPartModal.showModal();
    });
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            inventoryModal.close();
            manualPartModal.close();
            evidenceModal.close();
            patternViewModal.close();
        });
    });
    inventorySearchInput.addEventListener('input', async (e) => {
        const searchTerm = e.target.value;
        if (searchTerm.length < 2) {
            inventorySearchResults.innerHTML = '';
            return;
        }
        try {
            const response = await fetch(`/api/inventario?buscar=${encodeURIComponent(searchTerm)}`, { headers: { 'Authorization': `Bearer ${token}` } });
            const result = await response.json();
            inventorySearchResults.innerHTML = '';
            if (result.data && result.data.length > 0) {
                result.data.forEach(item => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'inventory-item';
                    itemDiv.innerHTML = `
                        <div class="info">
                            <strong>${item.nombre}</strong>
                            <small>Stock Total: ${item.cantidad_total} | Costo: ${(item.precio_costo || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</small>
                        </div>
                        <button class="outline" data-id="${item.id}" data-nombre="${item.nombre}" data-costo="${item.precio_costo || 0}">Añadir</button>
                    `;
                    inventorySearchResults.appendChild(itemDiv);
                });
            } else {
                inventorySearchResults.innerHTML = '<p style="padding: 1rem; text-align: center;">No se encontraron productos.</p>';
            }
        } catch (error) { console.error('Error buscando en inventario:', error); }
    });
    inventorySearchResults.addEventListener('click', (e) => {
        const addButton = e.target.closest('button');
        if (addButton) {
            addPartToList({
                inventoryId: addButton.dataset.id,
                nombre: addButton.dataset.nombre,
                costo: parseFloat(addButton.dataset.costo)
            });
            inventoryModal.close();
        }
    });
    manualPartForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(manualPartForm);
        addPartToList({
            nombre: formData.get('nombre'),
            costo: parseFloat(formData.get('costo'))
        });
        manualPartModal.close();
    });
    usedPartsTbody.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-part-btn');
        if (deleteBtn) {
            const index = parseInt(deleteBtn.dataset.index, 10);
            usedParts.splice(index, 1);
            renderUsedParts();
        }
    });
    
    // --- LÓGICA PARA DIBUJAR EL PATRÓN GUARDADO ---
    const drawSavedPattern = (patternSequenceString) => {
        const patternDots = document.querySelectorAll('.pattern-dot-view');
        const ctx = patternViewCanvas.getContext('2d');
        let dotCoords = [];
        patternViewCanvas.width = patternViewGrid.clientWidth;
        patternViewCanvas.height = patternViewGrid.clientHeight;
        patternDots.forEach(dot => {
            const rect = dot.getBoundingClientRect();
            const gridRect = patternViewGrid.getBoundingClientRect();
            dotCoords.push({
                id: dot.dataset.id,
                x: rect.left + rect.width / 2 - gridRect.left,
                y: rect.top + rect.height / 2 - gridRect.top
            });
            dot.classList.remove('active', 'start-node');
        });
        const sequence = patternSequenceString.split('-');
        if (sequence.length === 0) return;
        sequence.forEach((dotId, index) => {
            const dotElement = document.querySelector(`.pattern-dot-view[data-id="${dotId}"]`);
            if (dotElement) {
                dotElement.classList.add('active');
                if (index === 0) {
                    dotElement.classList.add('start-node');
                }
            }
        });
        ctx.clearRect(0, 0, patternViewCanvas.width, patternViewCanvas.height);
        ctx.beginPath();
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'var(--pico-primary)';
        const firstDot = dotCoords.find(c => c.id == sequence[0]);
        ctx.moveTo(firstDot.x, firstDot.y);
        sequence.forEach(dotId => {
            const coord = dotCoords.find(c => c.id == dotId);
            ctx.lineTo(coord.x, coord.y);
        });
        ctx.stroke();
    };

    // --- LÓGICA DE GUARDADO Y FINALIZACIÓN ---
    if (reparacionForm) {
        reparacionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            guardarCambiosBtn.setAttribute('aria-busy', 'true');
            guardarCambiosBtn.disabled = true;
            const updateData = {
                estado: estadoSelect.value,
                diagnostico_tecnico: diagnosticoTextarea.value,
                repuestos_utilizados: JSON.stringify(usedParts),
                precio_final: precioFinalInput.value || null
            };
            try {
                const response = await fetch(`/api/ordenes/${currentOrderId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(updateData)
                });
                if (!response.ok) {
                    const errorResult = await response.json();
                    throw new Error(errorResult.error || 'Error desconocido.');
                }
                alert('¡Orden actualizada con éxito!');
            } catch (error) {
                console.error('Error al actualizar:', error);
                alert(`Error al guardar: ${error.message}`);
            } finally {
                guardarCambiosBtn.removeAttribute('aria-busy');
                guardarCambiosBtn.disabled = false;
            }
        });
    }
    
    const updateSendToCashierButtonVisibility = () => {
        const isReady = ['Reparado', 'Listo para Entrega'].includes(estadoSelect.value);
        sendToCashierBtn.classList.toggle('hidden', !isReady);
    };

    estadoSelect.addEventListener('change', updateSendToCashierButtonVisibility);
    
    if (sendToCashierBtn) {
        sendToCashierBtn.addEventListener('click', () => {
            const precioFinal = parseFloat(precioFinalInput.value);
            if (!precioFinal || precioFinal <= 0) {
                alert('Por favor, define un "Precio Final para el Cliente" antes de enviar a caja.');
                precioFinalInput.focus();
                return;
            }
            const costoTotalRepuestos = usedParts.reduce((sum, part) => sum + (parseFloat(part.costo) || 0), 0);
            const equipo = `${currentOrderData.equipo_marca || ''} ${currentOrderData.equipo_modelo || ''}`.trim();
            
            const ticketItem = {
                orden_id: currentOrderId,
                cliente_nombre: currentOrderData.cliente_nombre,
                producto_id: null,
                descripcion: `Reparación ${equipo} (Orden #${String(currentOrderId).padStart(5, '0')})`,
                cantidad: 1,
                precio_unitario: precioFinal,
                costo_unitario: costoTotalRepuestos
            };

            sessionStorage.setItem('pendingSaleItem', JSON.stringify(ticketItem));
            window.location.href = 'caja.html';
        });
    }
    
    // --- DELEGACIÓN DE EVENTOS PARA BOTONES DINÁMICOS ---
    infoSection.addEventListener('click', (e) => {
        const evidenceBtn = e.target.closest('#view-evidence-btn');
        const patternBtn = e.target.closest('.js-view-pattern');

        if (evidenceBtn) {
            evidenceModalGallery.innerHTML = '';
            currentOrderData.fotos.forEach(photoFile => {
                const link = document.createElement('a');
                link.href = `/uploads/${photoFile}`;
                link.target = '_blank';
                link.innerHTML = `<img src="/uploads/${photoFile}" alt="Evidencia">`;
                evidenceModalGallery.appendChild(link);
            });
            evidenceModal.showModal();
            feather.replace();
        }

        if (patternBtn) {
            patternViewModal.showModal();
            setTimeout(() => {
                drawSavedPattern(patternBtn.dataset.pattern);
            }, 50);
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
    loadOrderData();
});