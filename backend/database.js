const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

console.log('--- Módulo database.js cargado ---');

const initializeDatabase = () => {
    return new Promise((resolve, reject) => {

        // --- CORRECCIÓN CLAVE Y DEFINITIVA: Usamos ProgramData en lugar de AppData ---
        const isPackaged = typeof process.pkg !== 'undefined';
        const dataPath = isPackaged 
            ? path.join(process.env.PROGRAMDATA, 'ServiTech') // <- CAMBIO IMPORTANTE
            : path.join(__dirname, '..');

        if (isPackaged && !fs.existsSync(dataPath)) {
            fs.mkdirSync(dataPath, { recursive: true });
        }
        
        const dbPath = path.join(dataPath, 'gestion_taller.sqlite');
        
        console.log(`Ruta de la base de datos determinada: ${dbPath}`);
        
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('ERROR FATAL al conectar con la base de datos:', err.message);
                return reject(err);
            }
            console.log('Conexión con la base de datos SQLite establecida con éxito.');
        });

        console.log('Iniciando creación/verificación de todas las tablas...');
        db.serialize(() => {
            const queries = [
                `CREATE TABLE IF NOT EXISTS ordenes (id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_nombre TEXT NOT NULL, cliente_telefono TEXT, cliente_email TEXT, equipo_marca TEXT, equipo_modelo TEXT, imei_serial TEXT, desbloqueo TEXT, falla_reportada TEXT NOT NULL, detalles_esteticos TEXT, otro_detalle TEXT, accesorios TEXT, cotizacion_inicial REAL, taller TEXT, diagnostico_tecnico TEXT, repuestos_utilizados TEXT, precio_final REAL, estado TEXT DEFAULT 'Recibido', fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP)`,
                `CREATE TABLE IF NOT EXISTS fotos_evidencia (id INTEGER PRIMARY KEY AUTOINCREMENT, orden_id INTEGER NOT NULL, ruta_archivo TEXT NOT NULL, FOREIGN KEY (orden_id) REFERENCES ordenes(id) ON DELETE CASCADE)`,
                `CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, usuario TEXT NOT NULL UNIQUE, password TEXT NOT NULL, rol TEXT NOT NULL CHECK(rol IN ('administrador', 'tecnico', 'recepcionista')), estado TEXT NOT NULL DEFAULT 'activo', fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP)`,
                `CREATE TABLE IF NOT EXISTS proveedores (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL UNIQUE, contacto TEXT, telefono TEXT, email TEXT, direccion TEXT)`,
                `CREATE TABLE IF NOT EXISTS productos (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, descripcion TEXT, precio_costo REAL, precio_venta REAL NOT NULL, proveedor_id INTEGER, fecha_agregado DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (proveedor_id) REFERENCES proveedores(id))`,
                `CREATE TABLE IF NOT EXISTS inventario_stock (id INTEGER PRIMARY KEY AUTOINCREMENT, producto_id INTEGER NOT NULL, taller TEXT NOT NULL, cantidad INTEGER NOT NULL DEFAULT 0, stock_minimo INTEGER DEFAULT 5, FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE)`,
                `CREATE TABLE IF NOT EXISTS ventas (id INTEGER PRIMARY KEY AUTOINCREMENT, orden_id INTEGER, cliente_nombre TEXT, cliente_documento TEXT, total REAL NOT NULL, metodo_pago TEXT, fecha_venta DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (orden_id) REFERENCES ordenes(id))`,
                `CREATE TABLE IF NOT EXISTS venta_items (id INTEGER PRIMARY KEY AUTOINCREMENT, venta_id INTEGER NOT NULL, producto_id INTEGER, descripcion TEXT NOT NULL, cantidad INTEGER NOT NULL, precio_unitario REAL NOT NULL, costo_unitario REAL DEFAULT 0, subtotal REAL NOT NULL, FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE, FOREIGN KEY (producto_id) REFERENCES productos(id))`,
                `CREATE TABLE IF NOT EXISTS cuentas_por_pagar (id INTEGER PRIMARY KEY AUTOINCREMENT, proveedor_id INTEGER, numero_factura TEXT, descripcion TEXT, monto_total REAL NOT NULL, descuento_pronto_pago REAL DEFAULT 0, fecha_emision DATE, fecha_vencimiento DATE, estado TEXT NOT NULL DEFAULT 'pendiente', FOREIGN KEY (proveedor_id) REFERENCES proveedores(id))`,
                `CREATE TABLE IF NOT EXISTS pagos_proveedores (id INTEGER PRIMARY KEY AUTOINCREMENT, cuenta_id INTEGER NOT NULL, monto REAL NOT NULL, descuento REAL DEFAULT 0, metodo_pago TEXT, fecha_pago DATETIME DEFAULT CURRENT_TIMESTAMP, notas TEXT, FOREIGN KEY (cuenta_id) REFERENCES cuentas_por_pagar(id) ON DELETE CASCADE)`,
                `CREATE TABLE IF NOT EXISTS configuracion (clave TEXT PRIMARY KEY NOT NULL, valor TEXT)`
            ];

            db.exec(queries.join(';'), (err) => {
                if (err) {
                    console.error("Error al crear las tablas:", err.message);
                    return reject(err);
                }
                console.log('Todas las tablas han sido verificadas/creadas con éxito.');
                console.log('--- Inicialización de la base de datos completada ---');
                resolve(db);
            });
        });
    });
};

module.exports = { initializeDatabase };