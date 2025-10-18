document.addEventListener('DOMContentLoaded', () => {
    // --- LÓGICA DE SEGURIDAD ---
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = '../login.html';
        return;
    }

    // --- SELECTORES GLOBALES ---
    const printReceiptBtn = document.getElementById('print-receipt-btn');
    let currentVentaId = null;

    // --- LÓGICA PRINCIPAL DE CARGA DE DATOS ---
    const loadPageData = async () => {
        const params = new URLSearchParams(window.location.search);
        currentVentaId = params.get('id');

        if (!currentVentaId) {
            document.body.innerHTML = '<h1>Error: No se ha especificado un número de venta.</h1>';
            return;
        }

        try {
            // Hacemos ambas peticiones (venta y config) al mismo tiempo
            const [ventaResponse, configResponse] = await Promise.all([
                fetch(`/api/ventas/${currentVentaId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/configuracion', { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            if (!ventaResponse.ok) throw new Error('La venta no fue encontrada.');
            if (!configResponse.ok) throw new Error('No se pudo cargar la configuración de la empresa.');

            const ventaResult = await ventaResponse.json();
            const configResult = await configResponse.json();

            populateConfig(configResult.data);
            populateReceipt(ventaResult.data);

        } catch (error) {
            console.error('Error al cargar los datos de la página:', error);
            document.body.innerHTML = `<h1>Error al cargar la página: ${error.message}</h1>`;
        }
    };

    // --- LÓGICA DE POBLACIÓN DE DATOS ---

    // NUEVO: Función para rellenar los datos de la empresa
    const populateConfig = (config) => {
        document.querySelectorAll('.company-name').forEach(el => el.textContent = config.nombre_empresa || 'Nombre no configurado');
        document.querySelectorAll('.company-address').forEach(el => el.textContent = config.direccion_empresa || 'Dirección no configurada');
        document.querySelectorAll('.company-phone').forEach(el => el.textContent = config.telefono_empresa || 'Teléfono no configurado');
    };

    const populateReceipt = (data) => {
        const utcDateString = data.fecha_venta;
        const isoUtcString = utcDateString.replace(' ', 'T') + 'Z';
        const date = new Date(isoUtcString);
        const fechaFormateada = date.toLocaleString('es-CO', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        
        document.getElementById('factura-id').textContent = String(data.id).padStart(6, '0');
        document.getElementById('factura-fecha').textContent = fechaFormateada;
        document.getElementById('factura-cliente').textContent = data.cliente_nombre || 'Venta General';
        document.getElementById('factura-metodo-pago').textContent = data.metodo_pago || 'N/A';

        const itemsTbody = document.getElementById('factura-items');
        itemsTbody.innerHTML = '';
        data.items.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.cantidad}</td>
                <td>${item.descripcion}</td>
                <td>${item.subtotal.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</td>
            `;
            itemsTbody.appendChild(tr);
        });

        document.getElementById('factura-subtotal').textContent = data.total.toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
        document.getElementById('factura-total').textContent = data.total.toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
    };
    
    // --- FUNCIÓN DE IMPRESIÓN CON PDF ---
    const generateAndPrintPDF = () => {
        const elementToPrint = document.querySelector('.thermal-format');
        const ventaIdPadded = String(currentVentaId).padStart(6, '0');
        
        printReceiptBtn.setAttribute('aria-busy', 'true');
        printReceiptBtn.disabled = true;

        const opt = {
            margin: [5, 5, 5, 5], // Añadimos un pequeño margen para que no quede pegado al borde
            filename: `factura-${ventaIdPadded}.pdf`,
            image: { type: 'jpeg', quality: 1.0 },
            html2canvas: { scale: 3, useCORS: true },
            jsPDF: { unit: 'mm', format: [80, 297], orientation: 'portrait' }
        };

        html2pdf().set(opt).from(elementToPrint).outputPdf('blob').then((pdfBlob) => {
            const pdfUrl = URL.createObjectURL(pdfBlob);
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = pdfUrl;
            document.body.appendChild(iframe);
            iframe.onload = () => {
                setTimeout(() => {
                    iframe.contentWindow.print();
                    setTimeout(() => document.body.removeChild(iframe), 1000);
                }, 500);
            };
        }).finally(() => {
            printReceiptBtn.removeAttribute('aria-busy');
            printReceiptBtn.disabled = false;
        });
    };

    // --- MANEJO DE EVENTOS ---
    if (printReceiptBtn) {
        printReceiptBtn.addEventListener('click', generateAndPrintPDF);
    }
    
    // --- INICIALIZACIÓN ---
    loadPageData();
});