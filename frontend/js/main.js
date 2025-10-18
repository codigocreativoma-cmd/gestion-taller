document.addEventListener('DOMContentLoaded', () => {
    // --- LÓGICA DE SEGURIDAD Y ROLES ---
    const token = localStorage.getItem('authToken');
    const userRole = localStorage.getItem('userRole');
    if (!token) {
        window.location.href = 'login.html'; // Desde index, la ruta es directa
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
    const ordenForm = document.getElementById('orden-form');
    const otroDetalleCheck = document.getElementById('otro-detalle-check');
    const otroDetalleTextareaContainer = document.getElementById('otro-detalle-textarea-container');
    const addFotoButton = document.getElementById('add-foto-button');
    const fotosInput = document.getElementById('fotos-input');
    const fotosPreviewContainer = document.getElementById('fotos-preview-container');
    const ordenesTbody = document.getElementById('ordenes-tbody');
    const showFormButtons = document.querySelectorAll('.js-show-form');
    const hideFormButtons = document.querySelectorAll('.js-hide-form');

    const postCreationModal = document.getElementById('post-creation-modal');
    const closePostCreationModalButtons = document.querySelectorAll('.js-close-post-creation-modal');
    const downloadStickerBtn = document.getElementById('download-sticker-btn');
    const viewReceiptBtn = document.getElementById('view-receipt-btn');
    const logoutBtn = document.getElementById('logout-btn');
    
    const desbloqueoInput = document.getElementById('desbloqueo-input');
    const drawPatternBtn = document.getElementById('draw-pattern-btn');
    const patternWrapper = document.getElementById('pattern-wrapper');
    const patternGrid = document.getElementById('pattern-grid');
    const patternCanvas = document.getElementById('pattern-canvas');
    const clearPatternBtn = document.getElementById('clear-pattern-btn');
    const savePatternBtn = document.getElementById('save-pattern-btn');
    const patternDots = document.querySelectorAll('.pattern-dot');
    
    let evidenceFiles = [];
    let currentNewOrderId = null;
    let isDrawing = false;
    let patternSequence = [];
    let dotCoords = [];
    const ctx = patternCanvas.getContext('2d');

    // --- LÓGICA DE LA INTERFAZ PRINCIPAL ---
    const showForm = () => body.classList.add('form-active');
    const hideForm = () => {
        body.classList.remove('form-active');
        patternWrapper.classList.add('hidden');
        clearPattern();
    };
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
            localStorage.removeItem('userRole'); // Limpiar el rol
            window.location.href = 'login.html'; // Ruta directa desde index
        });
    }

    // --- LÓGICA DEL FORMULARIO ---
    if (ordenForm) {
        ordenForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(ordenForm);
            formData.set('detalles_esteticos', JSON.stringify(Array.from(formData.getAll('detalles_esteticos'))));
            evidenceFiles.forEach(file => formData.append('evidencia', file));
            
            try {
                const response = await fetch('/api/ordenes', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
                const result = await response.json();
                if (response.ok) {
                    showPostCreationActions(result.data.id);
                    ordenForm.reset();
                    evidenceFiles = [];
                    renderPreviews();
                    otroDetalleTextareaContainer.classList.add('hidden');
                    hideForm();
                    fetchOrdenes();
                } else {
                    alert(`Error al crear la orden: ${result.error}`);
                }
            } catch (error) {
                console.error('Error de red:', error);
                alert('Error de conexión con el servidor.');
            }
        });
    }
    if (otroDetalleCheck) { otroDetalleCheck.addEventListener('change', () => { otroDetalleTextareaContainer.classList.toggle('hidden', !otroDetalleCheck.checked); }); }
    if (addFotoButton) addFotoButton.addEventListener('click', () => fotosInput.click());
    if (fotosInput) { fotosInput.addEventListener('change', () => { evidenceFiles.push(...Array.from(fotosInput.files)); renderPreviews(); fotosInput.value = ''; }); }
    const renderPreviews = () => { if (!fotosPreviewContainer) return; fotosPreviewContainer.innerHTML = ''; evidenceFiles.forEach((file, index) => { const reader = new FileReader(); reader.onload = (e) => { const previewDiv = document.createElement('div'); previewDiv.className = 'foto-preview'; previewDiv.innerHTML = `<img src="${e.target.result}" alt="${file.name}"><button type="button" class="remove-foto" data-index="${index}">&times;</button>`; fotosPreviewContainer.appendChild(previewDiv); }; reader.readAsDataURL(file); }); };
    if (fotosPreviewContainer) { fotosPreviewContainer.addEventListener('click', (e) => { if (e.target.classList.contains('remove-foto')) { evidenceFiles.splice(parseInt(e.target.dataset.index, 10), 1); renderPreviews(); } }); }
    
    // --- LÓGICA DE LA MODAL DE ACCIONES Y DESCARGA DE ETIQUETAS ---
    const downloadBarcodeAsPng = (orderId) => {
        const canvas = document.getElementById('download-barcode-canvas');
        if (!canvas) return;
        const orderIdPadded = String(orderId).padStart(5, '0');
        JsBarcode(canvas, orderIdPadded, {
            format: "CODE128", width: 3, height: 80, displayValue: true, fontSize: 24, margin: 10
        });
        const pngUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = `etiqueta-orden-${orderIdPadded}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    const showPostCreationActions = (orderId) => {
        currentNewOrderId = orderId;
        document.getElementById('new-order-id').textContent = orderId;
        viewReceiptBtn.href = `html/recibo.html?id=${orderId}`;
        viewReceiptBtn.target = '_blank';
        postCreationModal.showModal();
        feather.replace();
    };
    closePostCreationModalButtons.forEach(btn => btn.addEventListener('click', () => postCreationModal.close()));
    if (downloadStickerBtn) { downloadStickerBtn.addEventListener('click', () => { if (currentNewOrderId) { downloadBarcodeAsPng(currentNewOrderId); } }); }

    // --- LÓGICA DE VISUALIZACIÓN DE ÓRDENES ---
    const fetchOrdenes = async (filtro = 'recientes') => {
        if (!ordenesTbody) return;
        ordenesTbody.innerHTML = '<tr><td colspan="7" aria-busy="true">Cargando órdenes...</td></tr>';
        try {
            const response = await fetch(`/api/ordenes?filtro=${filtro}`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (response.status === 401 || response.status === 403) { localStorage.removeItem('authToken'); window.location.href = 'login.html'; return; }
            const result = await response.json();
            ordenesTbody.innerHTML = '';
            if (response.ok && result.data.length > 0) {
                result.data.forEach(orden => {
                    const tr = document.createElement('tr');
                    const equipo = `${orden.equipo_marca || ''} ${orden.equipo_modelo || ''}`.trim();
                    const fecha = new Date(orden.fecha_creacion.replace(' ', 'T') + 'Z').toLocaleDateString('es-CO');
                    tr.innerHTML = `
                        <td class="desktop-only">${orden.id}</td>
                        <td><strong>${equipo || 'N/A'}</strong></td>
                        <td>${orden.falla_reportada}</td>
                        <td class="desktop-only">${orden.cliente_nombre}</td>
                        <td class="desktop-only">${fecha}</td>
                        <td><mark>${orden.estado}</mark></td>
                        <td><div class="action-buttons">
                            <a href="html/recibo.html?id=${orden.id}" target="_blank" role="button" class="outline" title="Ver Recibo"><i data-feather="printer"></i></a>
                            <button class="outline js-download-sticker" data-id="${orden.id}" title="Descargar Etiqueta"><i data-feather="tag"></i></button>
                            <a href="html/reparacion.html?id=${orden.id}" role="button" class="outline" title="Iniciar Reparación"><i data-feather="tool"></i></a>
                        </div></td>`;
                    ordenesTbody.appendChild(tr);
                });
            } else {
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                td.colSpan = 7;
                td.style.textAlign = 'center';
                td.textContent = 'No se encontraron órdenes para este filtro.';
                tr.appendChild(td);
                ordenesTbody.appendChild(tr);
            }
            feather.replace();
        } catch (error) { console.error('Error de conexión:', error); }
    };
    
    // --- MANEJO DE EVENTOS ---
    ordenesTbody.addEventListener('click', (e) => {
        const downloadButton = e.target.closest('.js-download-sticker');
        if (downloadButton) {
            e.preventDefault();
            const orderId = downloadButton.dataset.id;
            downloadBarcodeAsPng(orderId);
        }
    });
    const filterTabs = document.querySelectorAll('.filter-tabs a');
    filterTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const filtroSeleccionado = tab.dataset.filter;
            fetchOrdenes(filtroSeleccionado);
        });
    });

    // --- LÓGICA DEL PATRÓN DE DESBLOQUEO ---
    const setupPatternGrid = () => {
        const gridRect = patternGrid.getBoundingClientRect();
        patternCanvas.width = gridRect.width;
        patternCanvas.height = gridRect.height;
        dotCoords = [];
        patternDots.forEach(dot => {
            const dotRect = dot.getBoundingClientRect();
            dotCoords.push({
                id: dot.dataset.id,
                x: dotRect.left + dotRect.width / 2 - gridRect.left,
                y: dotRect.top + dotRect.height / 2 - gridRect.top
            });
        });
    };
    const clearPattern = () => {
        isDrawing = false;
        patternSequence = [];
        ctx.clearRect(0, 0, patternCanvas.width, patternCanvas.height);
        patternDots.forEach(dot => dot.classList.remove('active'));
    };
    const drawLines = (endPoint = null) => {
        ctx.clearRect(0, 0, patternCanvas.width, patternCanvas.height);
        if (patternSequence.length === 0) return;
        ctx.beginPath();
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'var(--pico-primary)';
        const firstDot = dotCoords.find(c => c.id == patternSequence[0]);
        ctx.moveTo(firstDot.x, firstDot.y);
        patternSequence.forEach(dotId => {
            const coord = dotCoords.find(c => c.id == dotId);
            ctx.lineTo(coord.x, coord.y);
        });
        if (isDrawing && endPoint) {
            ctx.lineTo(endPoint.x, endPoint.y);
        }
        ctx.stroke();
    };
    const getDotFromPosition = (x, y) => {
        for (const coord of dotCoords) {
            const distance = Math.sqrt(Math.pow(x - coord.x, 2) + Math.pow(y - coord.y, 2));
            if (distance < 20) { return coord.id; }
        }
        return null;
    };
    const handleInteractionStart = (e) => { e.preventDefault(); clearPattern(); isDrawing = true; };
    const handleInteractionMove = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const rect = patternCanvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const dotId = getDotFromPosition(x, y);
        if (dotId && !patternSequence.includes(dotId)) {
            patternSequence.push(dotId);
            document.querySelector(`.pattern-dot[data-id="${dotId}"]`).classList.add('active');
        }
        drawLines({ x, y });
    };
    const handleInteractionEnd = (e) => { if (!isDrawing) return; e.preventDefault(); isDrawing = false; drawLines(); };
    drawPatternBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = patternWrapper.classList.contains('hidden');
        if (isHidden) {
            const btnRect = drawPatternBtn.getBoundingClientRect();
            patternWrapper.style.top = `${btnRect.bottom + window.scrollY + 5}px`;
            patternWrapper.style.left = `${btnRect.left + window.scrollX}px`;
            patternWrapper.classList.remove('hidden');
            setupPatternGrid();
            clearPattern();
        } else {
            patternWrapper.classList.add('hidden');
        }
    });
    clearPatternBtn.addEventListener('click', clearPattern);
    savePatternBtn.addEventListener('click', () => {
        desbloqueoInput.value = patternSequence.join('-');
        patternWrapper.classList.add('hidden');
    });
    document.addEventListener('click', (e) => {
        if (!patternWrapper.classList.contains('hidden') && !patternWrapper.contains(e.target) && e.target !== drawPatternBtn) {
            patternWrapper.classList.add('hidden');
        }
    });
    patternGrid.addEventListener('mousedown', handleInteractionStart);
    patternGrid.addEventListener('mousemove', handleInteractionMove);
    document.addEventListener('mouseup', handleInteractionEnd);
    patternGrid.addEventListener('touchstart', handleInteractionStart);
    patternGrid.addEventListener('touchmove', handleInteractionMove);
    patternGrid.addEventListener('touchend', handleInteractionEnd);

    const setCacheBustedLogo = () => {
        const logos = document.querySelectorAll('.sidebar-logo');
        logos.forEach(logo => {
            // La ruta cambia a 2 niveles arriba para los archivos en /html/
            logo.src = `../img/logo.png?v=${new Date().getTime()}`;
        });
    };

    // --- INICIALIZACIÓN ---
    applyTheme(localStorage.getItem('theme') || 'light');
    fetchOrdenes();
});