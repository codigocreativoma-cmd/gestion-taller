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
    const htmlElement = document.documentElement;

    const reportForm = document.getElementById('report-form');
    const fechaInicioInput = document.getElementById('fecha-inicio');
    const fechaFinInput = document.getElementById('fecha-fin');

    const summarySection = document.getElementById('summary-section');
    const totalIngresosEl = document.getElementById('total-ingresos');
    const totalCostosEl = document.getElementById('total-costos');
    const gananciaBrutaEl = document.getElementById('ganancia-bruta');
    const reportDetailsTbody = document.getElementById('report-details-tbody');
    const detailsSection = document.getElementById('details-section');

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

    // --- LÓGICA DE REPORTES ---
    const formatCurrency = (value) => {
        return (value || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
    };

    const fetchReportData = async (inicio, fin) => {
        summarySection.setAttribute('aria-busy', 'true');
        detailsSection.setAttribute('aria-busy', 'true');
        reportDetailsTbody.innerHTML = '';

        try {
            const response = await fetch(`/api/reportes/ventas?inicio=${inicio}&fin=${fin}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('authToken');
                window.location.href = '../login.html';
                return;
            }
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Error del servidor');

            totalIngresosEl.textContent = formatCurrency(result.data.summary.totalIngresos);
            totalCostosEl.textContent = formatCurrency(result.data.summary.totalCostos);
            gananciaBrutaEl.textContent = formatCurrency(result.data.summary.gananciaBruta);

            if (result.data.details.length > 0) {
                result.data.details.forEach(venta => {
                    const tr = document.createElement('tr');
                    const fechaVenta = new Date(venta.fecha_venta.replace(' ', 'T') + 'Z').toLocaleString('es-CO');
                    tr.innerHTML = `
                        <td>${String(venta.id).padStart(6, '0')}</td>
                        <td>${fechaVenta}</td>
                        <td>${venta.orden_id ? `Reparación Orden #${venta.orden_id}` : (venta.cliente_nombre || 'Venta General')}</td>
                        <td>${formatCurrency(venta.total)}</td>
                        <td>${venta.metodo_pago || 'N/A'}</td>
                    `;
                    reportDetailsTbody.appendChild(tr);
                });
            } else {
                reportDetailsTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No se encontraron ventas en este período.</td></tr>';
            }

        } catch (error) {
            console.error('Error al generar el reporte:', error);
            alert(`No se pudo generar el reporte: ${error.message}`);
        } finally {
            summarySection.removeAttribute('aria-busy');
            detailsSection.removeAttribute('aria-busy');
        }
    };

    // --- MANEJO DE EVENTOS ---
    if (reportForm) {
        reportForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const inicio = fechaInicioInput.value;
            const fin = fechaFinInput.value;
            if (!inicio || !fin) {
                alert('Por favor, selecciona una fecha de inicio y una fecha de fin.');
                return;
            }
            fetchReportData(inicio, fin);
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
    const initializePage = () => {
        applyTheme(localStorage.getItem('theme') || 'light');
        
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const formatDate = (date) => date.toISOString().split('T')[0];

        fechaInicioInput.value = formatDate(firstDayOfMonth);
        fechaFinInput.value = formatDate(today);

        fetchReportData(fechaInicioInput.value, fechaFinInput.value);
    };

    initializePage();
});