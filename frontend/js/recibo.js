document.addEventListener('DOMContentLoaded', () => {
    // --- LÓGICA DE SEGURIDAD ---
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = '../login.html';
        return;
    }

    // --- SELECTORES GLOBALES ---
    const printReceiptBtn = document.getElementById('print-receipt-btn');
    const formatRadios = document.querySelectorAll('input[name="print-format"]');
    let currentOrderId = null;

    // --- LÓGICA DE CARGA DE DATOS ---
    const loadPageData = async () => {
        const params = new URLSearchParams(window.location.search);
        currentOrderId = params.get('id');

        if (!currentOrderId) {
            document.body.innerHTML = '<h1>Error: No se ha especificado un número de orden.</h1>';
            return;
        }

        try {
            // Hacemos ambas peticiones (orden y config) al mismo tiempo para más eficiencia
            const [orderResponse, configResponse] = await Promise.all([
                fetch(`/api/ordenes/${currentOrderId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/configuracion', { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            if (!orderResponse.ok) throw new Error('La orden no fue encontrada.');
            if (!configResponse.ok) throw new Error('No se pudo cargar la configuración de la empresa.');

            const orderResult = await orderResponse.json();
            const configResult = await configResponse.json();

            populateConfig(configResult.data);
            populateReceipt(orderResult.data);
            
            feather.replace();

        } catch (error) {
            console.error('Error al cargar los datos de la página:', error);
            document.body.innerHTML = `<h1>Error al cargar la página: ${error.message}</h1>`;
        }
    };
    
    // --- LÓGICA DE POBLACIÓN DE DATOS ---

    // NUEVO: Función para rellenar los datos de la empresa y las políticas
    const populateConfig = (config) => {
        // Rellenar datos de la empresa en ambos formatos (A4 y térmico)
        document.querySelectorAll('.company-name').forEach(el => el.textContent = config.nombre_empresa || 'Nombre no configurado');
        document.querySelectorAll('.company-address').forEach(el => el.textContent = config.direccion_empresa || 'Dirección no configurada');
        document.querySelectorAll('.company-phone').forEach(el => el.textContent = config.telefono_empresa || 'Teléfono no configurado');

        // Rellenar las políticas del recibo
        const politicas = config.politicas || [];
        document.querySelectorAll('.receipt-politicas').forEach(list => {
            list.innerHTML = '';
            politicas.forEach(p => {
                const li = document.createElement('li');
                li.textContent = p;
                list.appendChild(li);
            });
        });
    };

    const populateReceipt = (data) => {
        const orderIdPadded = String(data.id).padStart(5, '0');
        const barcodeElements = document.querySelectorAll('.barcode');
        if (barcodeElements.length > 0) {
            try {
                barcodeElements.forEach(canvas => {
                    JsBarcode(canvas, orderIdPadded, {
                        format: "CODE128", lineColor: "#000", width: 2, height: 50, displayValue: true
                    });
                });
            } catch (e) { console.error("Error al renderizar el código de barras:", e); }
        }
        
        const fillElements = (selector, value) => { document.querySelectorAll(selector).forEach(el => el.textContent = value); };

        const utcDateString = data.fecha_creacion;
        const isoUtcString = utcDateString.replace(' ', 'T') + 'Z';
        const date = new Date(isoUtcString);
        const fechaFormateada = date.toLocaleString('es-CO', {
             year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true
        });

        const equipo = `${data.equipo_marca || ''} ${data.equipo_modelo || ''}`.trim() || 'N/A';
        let detalles = 'Ninguno';
        if (data.detalles_esteticos) {
            try { const parsedDetails = JSON.parse(data.detalles_esteticos); if(Array.isArray(parsedDetails) && parsedDetails.length > 0) detalles = parsedDetails.join(', '); } catch (e) { /* ignorar */ }
        }
        const cotizacion = parseFloat(data.cotizacion_inicial);
        const cotizacionTexto = !isNaN(cotizacion) && cotizacion > 0 ? cotizacion.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }) : 'Pendiente';

        fillElements('.receipt-id', orderIdPadded);
        fillElements('.receipt-fecha', fechaFormateada);
        fillElements('.receipt-cliente', data.cliente_nombre || 'N/A');
        fillElements('.receipt-telefono', data.cliente_telefono || 'N/A');
        fillElements('.receipt-equipo', equipo);
        fillElements('.receipt-imei', data.imei_serial || 'N/A');
        fillElements('.receipt-desbloqueo', data.desbloqueo || 'N/A');
        fillElements('.receipt-falla', data.falla_reportada || 'N/A');
        fillElements('.receipt-detalles', detalles);
        fillElements('.receipt-accesorios', data.accesorios || 'Ninguno');
        fillElements('.receipt-cotizacion', cotizacionTexto);
    };
    
    // --- FUNCIÓN DE IMPRESIÓN CON PDF ---
    const generateAndPrintPDF = () => {
        const elementToPrint = document.querySelector(`.${document.querySelector('input[name="print-format"]:checked').value}-format`);
        const orderIdPadded = String(currentOrderId).padStart(5, '0');
        printReceiptBtn.setAttribute('aria-busy', 'true');
        printReceiptBtn.disabled = true;
        
        const opt = {
            margin: 0,
            filename: `recibo-orden-${orderIdPadded}.pdf`,
            image: { type: 'jpeg', quality: 1.0 },
            html2canvas: { scale: 3, useCORS: true },
            jsPDF: { unit: 'mm', format: elementToPrint.classList.contains('a4-format') ? 'a4' : [80, 297], orientation: 'portrait' }
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
    formatRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.body.classList.remove('format-a4', 'format-thermal');
            document.body.classList.add(`format-${e.target.value}`);
        });
    });

    // --- INICIALIZACIÓN ---
    document.body.classList.add('format-a4');
    loadPageData(); // Llamamos a la nueva función principal
});