const express = require('express');
const path = require('path');
const { initializeDatabase } = require('./database.js');
const multer = require('multer');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

console.log('--- Módulo server.js cargado ---');

const startServer = async () => {
    try {
        // --- INICIO DEL BLOQUE A REEMPLAZAR ---

        // 1. LÓGICA DE RUTA INTELIGENTE
        const isPackaged = typeof process.pkg !== 'undefined';
        const dataPath = isPackaged 
            ? path.join(process.env.PROGRAMDATA, 'ServiTech') 
            : path.join(__dirname, '..');

        console.log(`Modo de ejecución: ${isPackaged ? 'INSTALADO' : 'DESARROLLO'}`);
        console.log(`Carpeta de datos del usuario establecida en: ${dataPath}`);

        const uploadsPath = path.join(dataPath, 'uploads');
        const jsonPath = path.join(dataPath, 'json');
        const imgPath = path.join(dataPath, 'img');

        if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });
        if (!fs.existsSync(jsonPath)) fs.mkdirSync(jsonPath, { recursive: true });
        if (!fs.existsSync(imgPath)) fs.mkdirSync(imgPath, { recursive: true });

        // 2. INICIALIZACIÓN DE LA BASE DE DATOS (ahora usa la ruta correcta)
        const db = await initializeDatabase(dataPath);
        console.log('La base de datos está lista. Iniciando el servidor Express...');

        // --- FIN DEL BLOQUE A REEMPLAZAR ---

        const app = express();
        const PORT = 3000;
        const TOKEN_SECRET = 'una_clave_secreta_muy_dificil_de_adivinar_para_produccion';

        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                const dir = path.join(__dirname, '..', 'uploads');
                if (!fs.existsSync(dir)) fs.mkdirSync(dir);
                cb(null, dir);
            },
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
                cb(null, `${uniqueSuffix}-${originalName.toLowerCase().split(' ').join('-')}`);
            }
        });
        const uploadEvidence = multer({ storage: storage });

        const logoStorage = multer.diskStorage({
            destination: (req, file, cb) => {
                cb(null, imgPath); // <- CORRECCIÓN CLAVE
            },
            filename: (req, file, cb) => {
                cb(null, 'logo.png');
            }
        });
        const uploadLogo = multer({ storage: logoStorage });

        const createAdminUser = async () => {
            db.get("SELECT * FROM usuarios WHERE usuario = ?", ['admin'], async (err, row) => {
                if (err) return console.error("Error al verificar usuario admin:", err.message);
                if (!row) {
                    console.log("Usuario 'admin' no encontrado. Creando usuario por defecto...");
                    try {
                        const hashedPassword = await bcrypt.hash('admin', 10);
                        const sql = `INSERT INTO usuarios (nombre, usuario, password, rol) VALUES (?, ?, ?, ?)`;
                        db.run(sql, ['Administrador', 'admin', hashedPassword, 'administrador'], (insertErr) => {
                            if (insertErr) return console.error("Error al crear usuario admin:", insertErr.message);
                            console.log(`****************************************************`);
                            console.log(`* Usuario 'admin' creado con la contraseña 'admin'. *`);
                            console.log(`* ¡Por favor, cámbiala en el futuro!           *`);
                            console.log(`****************************************************`);
                        });
                    } catch (hashErr) {
                        console.error("Error al encriptar la contraseña del admin:", hashErr);
                    }
                } else {
                    console.log("Usuario 'admin' ya existe. No se requiere acción.");
                }
            });
        };

        const ensureConfigFilesExist = () => {
            const companyConfigFile = path.join(jsonPath, 'empresa.json');
            const policiesConfigFile = path.join(jsonPath, 'politicas.json');
            if (!fs.existsSync(companyConfigFile)) {
                const defaultConfig = {
                    nombre_empresa: "ServiTech Soluciones",
                    direccion_empresa: "Calle Falsa 123, Cúcuta",
                    telefono_empresa: "300-123-4567"
                };
                fs.writeFileSync(companyConfigFile, JSON.stringify(defaultConfig, null, 2));
                console.log('Archivo empresa.json creado con valores por defecto.');
            }
            if (!fs.existsSync(policiesConfigFile)) {
                const defaultPolicies = [
                    "Todo equipo se recibe para diagnóstico. El costo de la reparación final puede variar.",
                    "La empresa no se hace responsable por la información contenida en el equipo.",
                    "Equipos con daños por humedad no tienen garantía.",
                    "Si el equipo no es retirado después de 90 días, será considerado en abandono."
                ];
                fs.writeFileSync(policiesConfigFile, JSON.stringify(defaultPolicies, null, 2));
                console.log('Archivo politicas.json creado con valores por defecto.');
            }
        };

        const authenticateToken = (req, res, next) => {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            if (token == null) return res.sendStatus(401);

            jwt.verify(token, TOKEN_SECRET, (err, user) => {
                if (err) return res.sendStatus(403);
                req.user = user;
                next();
            });
        };

        app.use(express.json());

        // --- SERVIDOR DE ARCHIVOS DOBLE (LÓGICA CORREGIDA) ---
        // 1. Sirve las carpetas de datos del usuario con alta prioridad.
        app.use('/uploads', express.static(uploadsPath));
        app.use('/img', express.static(imgPath));

        // 2. Sirve los archivos estáticos de la aplicación (HTML, CSS, JS) como fallback.
        app.use(express.static(path.join(__dirname, '..', 'frontend')));

        app.post('/api/login', (req, res) => {
            const { usuario, password } = req.body;
            const sql = `SELECT * FROM usuarios WHERE usuario = ? AND estado = 'activo'`;
            db.get(sql, [usuario], async (err, user) => {
                if (err) return res.status(500).json({ error: err.message });
                if (!user) return res.status(400).json({ error: "Usuario o contraseña incorrectos, o usuario inactivo." });
                try {
                    if (await bcrypt.compare(password, user.password)) {
                        const accessToken = jwt.sign({ id: user.id, usuario: user.usuario, rol: user.rol }, TOKEN_SECRET, { expiresIn: '8h' });
                        res.json({ accessToken: accessToken, rol: user.rol });
                    } else {
                        res.status(400).json({ error: "Usuario o contraseña incorrectos." });
                    }
                } catch (e) {
                    res.status(500).json({ error: "Error interno del servidor." });
                }
            });
        });
        
        // --- RUTAS PROTEGIDAS ---
        
        app.get('/api/ordenes', authenticateToken, (req, res) => {
            const { filtro } = req.query;
            let whereClause = '';
            switch (filtro) {
                case 'pendientes': whereClause = `WHERE o.estado IN ('Recibido', 'En Diagnóstico', 'Esperando Aprobación de Cliente')`; break;
                case 'en-ejecucion': whereClause = `WHERE o.estado IN ('En Reparación', 'Esperando Repuesto')`; break;
                case 'completadas': whereClause = `WHERE o.estado IN ('Reparado', 'Listo para Entrega', 'Entregado', 'Sin Solución')`; break;
            }
            const sql = `SELECT o.*, GROUP_CONCAT(f.ruta_archivo) as fotos FROM ordenes o LEFT JOIN fotos_evidencia f ON o.id = f.orden_id ${whereClause} GROUP BY o.id ORDER BY o.id DESC`;
            db.all(sql, [], (err, rows) => {
                if (err) return res.status(500).json({ "error": err.message });
                const data = rows.map(row => ({ ...row, fotos: row.fotos ? row.fotos.split(',') : [] }));
                res.json({ "message": "success", "data": data });
            });
        });
        app.get('/api/ordenes/:id', authenticateToken, (req, res) => {
            const id = req.params.id;
            const sql = `SELECT o.*, GROUP_CONCAT(f.ruta_archivo) as fotos FROM ordenes o LEFT JOIN fotos_evidencia f ON o.id = f.orden_id WHERE o.id = ? GROUP BY o.id`;
            db.get(sql, [id], (err, row) => {
                if (err) return res.status(500).json({ "error": err.message });
                if (row) {
                    const data = { ...row, fotos: row.fotos ? row.fotos.split(',') : [] };
                    res.json({ "message": "success", "data": data });
                } else {
                    res.status(404).json({ "error": "Orden no encontrada" });
                }
            });
        });
        app.post('/api/ordenes', authenticateToken, uploadEvidence.array('evidencia'), (req, res) => {
            const params = [ req.body.cliente_nombre, req.body.cliente_telefono, req.body.cliente_email, req.body.equipo_marca, req.body.equipo_modelo, req.body.imei_serial, req.body.desbloqueo, req.body.falla_reportada, req.body.detalles_esteticos, req.body.otro_detalle, req.body.accesorios, req.body.cotizacion_inicial || null, req.body.taller ];
            const sql = `INSERT INTO ordenes (cliente_nombre, cliente_telefono, cliente_email, equipo_marca, equipo_modelo, imei_serial, desbloqueo, falla_reportada, detalles_esteticos, otro_detalle, accesorios, cotizacion_inicial, taller) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            db.run(sql, params, function(err) {
                if (err) return res.status(500).json({ error: "Error interno al guardar la orden." });
                const ordenId = this.lastID;
                const files = req.files;
                if (files && files.length > 0) {
                    const fotoSql = `INSERT INTO fotos_evidencia (orden_id, ruta_archivo) VALUES (?, ?)`;
                    files.forEach(file => { db.run(fotoSql, [ordenId, file.filename]); });
                }
                res.status(201).json({ message: "success", data: { id: ordenId } });
            });
        });
        app.put('/api/ordenes/:id', authenticateToken, (req, res) => {
            const id = req.params.id;
            const { estado, diagnostico_tecnico, repuestos_utilizados, precio_final } = req.body;
            let fields = [];
            let params = [];
            if (estado) { fields.push("estado = ?"); params.push(estado); }
            if (diagnostico_tecnico !== undefined) { fields.push("diagnostico_tecnico = ?"); params.push(diagnostico_tecnico); }
            if (repuestos_utilizados !== undefined) { fields.push("repuestos_utilizados = ?"); params.push(repuestos_utilizados); }
            if (precio_final !== undefined) { fields.push("precio_final = ?"); params.push(precio_final); }
            if (fields.length === 0) return res.status(400).json({ error: "No hay campos para actualizar." });
            params.push(id);
            const sql = `UPDATE ordenes SET ${fields.join(', ')} WHERE id = ?`;
            db.run(sql, params, function(err) {
                if (err) return res.status(500).json({ error: err.message });
                if (this.changes === 0) return res.status(404).json({ error: "Orden no encontrada." });
                res.json({ message: "Orden actualizada con éxito." });
            });
        });

        app.get('/api/inventario', authenticateToken, (req, res) => {
            const pagina = parseInt(req.query.pagina, 10) || 1;
            const buscar = req.query.buscar || '';
            const limite = 20;
            const offset = (pagina - 1) * limite;
            const whereClause = buscar ? `WHERE p.nombre LIKE ?` : '';
            const searchParam = buscar ? [`%${buscar}%`] : [];
            const sqlData = `SELECT p.id, p.nombre, p.descripcion, p.precio_venta, p.precio_costo, pr.nombre as proveedor_nombre, COALESCE(SUM(s.cantidad), 0) as cantidad_total FROM productos p LEFT JOIN proveedores pr ON p.proveedor_id = pr.id LEFT JOIN inventario_stock s ON p.id = s.producto_id ${whereClause} GROUP BY p.id ORDER BY p.nombre ASC LIMIT ? OFFSET ?`;
            const sqlCount = `SELECT COUNT(DISTINCT p.id) as total FROM productos p ${whereClause}`;
            db.get(sqlCount, searchParam, (err, countResult) => {
                if (err) return res.status(500).json({ error: err.message });
                const totalProductos = countResult.total;
                const totalPaginas = Math.ceil(totalProductos / limite);
                db.all(sqlData, [...searchParam, limite, offset], (err, rows) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: "success", data: rows, pagination: { totalProductos, totalPaginas, paginaActual: pagina } });
                });
            });
        });
        app.post('/api/inventario', authenticateToken, (req, res) => {
            const { nombre, descripcion, cantidad, stock_minimo, precio_costo, precio_venta, proveedor_id, taller } = req.body;
            if (!nombre || precio_venta === undefined || !taller) return res.status(400).json({ error: "Nombre, precio de venta y taller son obligatorios." });
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                const productoSql = `INSERT INTO productos (nombre, descripcion, precio_costo, precio_venta, proveedor_id) VALUES (?, ?, ?, ?, ?)`;
                const productoParams = [nombre, descripcion, precio_costo, precio_venta, proveedor_id || null];
                db.run(productoSql, productoParams, function(err) {
                    if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
                    const productoId = this.lastID;
                    const stockSql = `INSERT INTO inventario_stock (producto_id, taller, cantidad, stock_minimo) VALUES (?, ?, ?, ?)`;
                    const stockParams = [productoId, taller, cantidad || 0, stock_minimo || 5];
                    db.run(stockSql, stockParams, (err) => {
                        if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
                        db.run('COMMIT', (err) => {
                            if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
                            res.status(201).json({ message: "Producto y stock inicial creados con éxito.", data: { id: productoId } });
                        });
                    });
                });
            });
        });
        app.get('/api/productos/:id/stock', authenticateToken, (req, res) => {
            const productoId = req.params.id;
            const sql = `SELECT * FROM inventario_stock WHERE producto_id = ?`;
            db.all(sql, [productoId], (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: "success", data: rows });
            });
        });
        app.get('/api/productos/:id', authenticateToken, (req, res) => {
            const sql = "SELECT * FROM productos WHERE id = ?";
            db.get(sql, [req.params.id], (err, row) => {
                if (err) return res.status(500).json({ error: err.message });
                if (!row) return res.status(404).json({ error: "Producto no encontrado." });
                res.json({ message: "success", data: row });
            });
        });
        app.put('/api/productos/:id', authenticateToken, (req, res) => {
            const { nombre, descripcion, precio_costo, precio_venta, proveedor_id } = req.body;
            if (!nombre || precio_venta === undefined) return res.status(400).json({ error: "Nombre y precio de venta son obligatorios." });
            const sql = `UPDATE productos SET nombre = ?, descripcion = ?, precio_costo = ?, precio_venta = ?, proveedor_id = ? WHERE id = ?`;
            const params = [nombre, descripcion, precio_costo, precio_venta, proveedor_id || null, req.params.id];
            db.run(sql, params, function(err) {
                if (err) return res.status(500).json({ error: err.message });
                if (this.changes === 0) return res.status(404).json({ error: "Producto no encontrado." });
                res.json({ message: "Producto actualizado con éxito." });
            });
        });
        app.delete('/api/productos/:id', authenticateToken, (req, res) => {
            const sql = `DELETE FROM productos WHERE id = ?`;
            db.run(sql, [req.params.id], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                if (this.changes === 0) return res.status(404).json({ error: "Producto no encontrado." });
                res.json({ message: "Producto eliminado con éxito." });
            });
        });
        app.post('/api/stock/add', authenticateToken, (req, res) => {
            const { producto_id, taller, cantidad } = req.body;
            if (!producto_id || !taller || !cantidad || cantidad <= 0) return res.status(400).json({ error: "Faltan datos para añadir el stock." });
            db.serialize(() => {
                const checkSql = `SELECT * FROM inventario_stock WHERE producto_id = ? AND taller = ?`;
                db.get(checkSql, [producto_id, taller], (err, row) => {
                    if (err) return res.status(500).json({ error: err.message });
                    if (row) {
                        const updateSql = `UPDATE inventario_stock SET cantidad = cantidad + ? WHERE id = ?`;
                        db.run(updateSql, [cantidad, row.id], function(err) {
                            if (err) return res.status(500).json({ error: err.message });
                            res.json({ message: "Stock actualizado con éxito." });
                        });
                    } else {
                        const insertSql = `INSERT INTO inventario_stock (producto_id, taller, cantidad) VALUES (?, ?, ?)`;
                        db.run(insertSql, [producto_id, taller, cantidad], function(err) {
                            if (err) return res.status(500).json({ error: err.message });
                            res.status(201).json({ message: "Stock creado y añadido con éxito." });
                        });
                    }
                });
            });
        });
        
        app.get('/api/proveedores', authenticateToken, (req, res) => {
            const sql = "SELECT * FROM proveedores ORDER BY nombre ASC";
            db.all(sql, [], (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: "success", data: rows });
            });
        });
        app.post('/api/proveedores', authenticateToken, (req, res) => {
            const { nombre, contacto, telefono, email, direccion } = req.body;
            if (!nombre) return res.status(400).json({ error: "El nombre del proveedor es obligatorio." });
            const sql = `INSERT INTO proveedores (nombre, contacto, telefono, email, direccion) VALUES (?, ?, ?, ?, ?)`;
            const params = [nombre, contacto, telefono, email, direccion];
            db.run(sql, params, function(err) {
                if (err) {
                    if (err.message.includes("UNIQUE constraint failed")) return res.status(409).json({ error: "Ya existe un proveedor con ese nombre." });
                    return res.status(500).json({ error: err.message });
                }
                res.status(201).json({ message: "Proveedor añadido con éxito.", data: { id: this.lastID } });
            });
        });
        app.get('/api/proveedores/:id', authenticateToken, (req, res) => {
            const sql = "SELECT * FROM proveedores WHERE id = ?";
            db.get(sql, [req.params.id], (err, row) => {
                if (err) return res.status(500).json({ error: err.message });
                if (!row) return res.status(404).json({ error: "Proveedor no encontrado." });
                res.json({ message: "success", data: row });
            });
        });
        app.put('/api/proveedores/:id', authenticateToken, (req, res) => {
            const { nombre, contacto, telefono, email, direccion } = req.body;
            if (!nombre) return res.status(400).json({ error: "El nombre del proveedor es obligatorio." });
            const sql = `UPDATE proveedores SET nombre = ?, contacto = ?, telefono = ?, email = ?, direccion = ? WHERE id = ?`;
            const params = [nombre, contacto, telefono, email, direccion, req.params.id];
            db.run(sql, params, function(err) {
                if (err) {
                    if (err.message.includes("UNIQUE constraint failed")) return res.status(409).json({ error: "Ya existe otro proveedor con ese nombre." });
                    return res.status(500).json({ error: err.message });
                }
                if (this.changes === 0) return res.status(404).json({ error: "Proveedor no encontrado." });
                res.json({ message: "Proveedor actualizado con éxito." });
            });
        });
        app.delete('/api/proveedores/:id', authenticateToken, (req, res) => {
            const sql = `DELETE FROM proveedores WHERE id = ?`;
            db.run(sql, [req.params.id], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                if (this.changes === 0) return res.status(404).json({ error: "Proveedor no encontrado." });
                res.json({ message: "Proveedor eliminado con éxito." });
            });
        });

        app.post('/api/ventas', authenticateToken, (req, res) => {
            const { orden_id, cliente_nombre, cliente_documento, total, metodo_pago, taller, items } = req.body;
            if (!total || !items || items.length === 0) return res.status(400).json({ error: "Faltan datos para registrar la venta." });
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                const ventaSql = `INSERT INTO ventas (orden_id, cliente_nombre, cliente_documento, total, metodo_pago) VALUES (?, ?, ?, ?, ?)`;
                db.run(ventaSql, [orden_id || null, cliente_nombre, cliente_documento, total, metodo_pago], function(err) {
                    if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
                    const ventaId = this.lastID;
                    items.forEach((item, index) => {
                        const itemSql = `INSERT INTO venta_items (venta_id, producto_id, descripcion, cantidad, precio_unitario, costo_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)`;
                        db.run(itemSql, [ventaId, item.producto_id || null, item.descripcion, item.cantidad, item.precio_unitario, item.costo_unitario || 0, item.subtotal]);
                        if (item.producto_id) {
                            const stockSql = `UPDATE inventario_stock SET cantidad = cantidad - ? WHERE producto_id = ? AND taller = ?`;
                            db.run(stockSql, [item.cantidad, item.producto_id, taller]);
                        }
                        if (index === items.length - 1) {
                            if (orden_id) {
                                db.run(`UPDATE ordenes SET estado = 'Entregado' WHERE id = ?`, [orden_id]);
                            }
                            db.run('COMMIT', (commitErr) => {
                                if (commitErr) { db.run('ROLLBACK'); return res.status(500).json({ error: commitErr.message }); }
                                res.status(201).json({ message: "Venta registrada con éxito.", data: { ventaId: ventaId } });
                            });
                        }
                    });
                });
            });
        });
        app.get('/api/ventas/:id', authenticateToken, (req, res) => {
            const ventaId = req.params.id;
            const ventaSql = `SELECT * FROM ventas WHERE id = ?`;
            const itemsSql = `SELECT * FROM venta_items WHERE venta_id = ?`;
            db.get(ventaSql, [ventaId], (err, venta) => {
                if (err) return res.status(500).json({ error: err.message });
                if (!venta) return res.status(404).json({ error: "Venta no encontrada." });
                db.all(itemsSql, [ventaId], (err, items) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: "success", data: { ...venta, items: items } });
                });
            });
        });
        
        // --- RUTAS DE CUENTAS POR PAGAR ---
        app.get('/api/cuentas-pagar', authenticateToken, (req, res) => {
            const { filtro } = req.query;
            let whereClause = `WHERE c.estado != 'pagado'`;
            let orderBy = `ORDER BY c.fecha_vencimiento ASC`;
            if (filtro === 'pagadas') {
                whereClause = `WHERE c.estado = 'pagado'`;
                orderBy = `ORDER BY fecha_pago_final DESC`;
            }
            const sql = `
                SELECT c.*, p.nombre as proveedor_nombre, 
                       (SELECT COALESCE(SUM(monto + descuento), 0) FROM pagos_proveedores WHERE cuenta_id = c.id) as monto_pagado,
                       (SELECT MAX(fecha_pago) FROM pagos_proveedores WHERE cuenta_id = c.id) as fecha_pago_final
                FROM cuentas_por_pagar c
                LEFT JOIN proveedores p ON c.proveedor_id = p.id
                ${whereClause}
                GROUP BY c.id
                ${orderBy}`;
            
            db.all(sql, [], (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: "success", data: rows });
            });
        });
        app.post('/api/cuentas-pagar', authenticateToken, (req, res) => {
            const { proveedor_id, numero_factura, descripcion, monto_total, fecha_emision, fecha_vencimiento, descuento_pronto_pago } = req.body;
            if (!monto_total) return res.status(400).json({ error: "El Monto Total es obligatorio." });
            const sql = `INSERT INTO cuentas_por_pagar (proveedor_id, numero_factura, descripcion, monto_total, fecha_emision, fecha_vencimiento, descuento_pronto_pago) VALUES (?, ?, ?, ?, ?, ?, ?)`;
            const params = [proveedor_id || null, numero_factura, descripcion, monto_total, fecha_emision || null, fecha_vencimiento || null, descuento_pronto_pago || 0];
            db.run(sql, params, function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.status(201).json({ message: "Cuenta por pagar registrada con éxito.", data: { id: this.lastID } });
            });
        });
        app.get('/api/cuentas-pagar/:id/pagos', authenticateToken, (req, res) => {
            const cuentaId = req.params.id;
            const sql = `SELECT * FROM pagos_proveedores WHERE cuenta_id = ? ORDER BY fecha_pago DESC`;
            db.all(sql, [cuentaId], (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: "success", data: rows });
            });
        });
        app.post('/api/cuentas-pagar/:id/pagos', authenticateToken, (req, res) => {
            const cuentaId = req.params.id;
            const { monto_abono, descuento_porcentaje, metodo_pago, notas } = req.body;
            const montoAbono = parseFloat(monto_abono) || 0;
            if (montoAbono < 0) return res.status(400).json({ error: "El monto del abono no puede ser negativo." });

            db.get(`SELECT c.*, (SELECT COALESCE(SUM(monto), 0) FROM pagos_proveedores WHERE cuenta_id = c.id) as pagado_actualmente FROM cuentas_por_pagar c WHERE c.id = ?`, [cuentaId], (err, cuenta) => {
                if (err) return res.status(500).json({ error: err.message });
                if (!cuenta) return res.status(404).json({ error: "Cuenta no encontrada." });

                const saldoActual = cuenta.monto_total - cuenta.pagado_actualmente;
                let montoFinalParaLiquidar = saldoActual;
                let descuentoAplicado = 0;

                const hoy = new Date().toISOString().split('T')[0];
                const aplicaDescuento = cuenta.fecha_vencimiento && hoy <= cuenta.fecha_vencimiento && cuenta.descuento_pronto_pago > 0;

                if (aplicaDescuento) {
                    const montoConDescuentoTotal = cuenta.monto_total * (1 - cuenta.descuento_pronto_pago / 100);
                    montoFinalParaLiquidar = montoConDescuentoTotal - cuenta.pagado_actualmente;
                }

                if (montoAbono > (montoFinalParaLiquidar + 0.01)) {
                    return res.status(400).json({ error: `El pago (${montoAbono}) supera el saldo pendiente (${montoFinalParaLiquidar.toFixed(2)}).` });
                }

                // CORRECCIÓN DE LÓGICA DEFINITIVA
                const esPagoFinal = (montoAbono + 0.01) >= montoFinalParaLiquidar;
                let nuevoEstado = 'abonado';

                if (esPagoFinal) {
                    nuevoEstado = 'pagado';
                    if (aplicaDescuento) {
                        descuentoAplicado = saldoActual - montoAbono;
                    }
                }

                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');
                    const pagoSql = `INSERT INTO pagos_proveedores (cuenta_id, monto, descuento, metodo_pago, notas) VALUES (?, ?, ?, ?, ?)`;
                    db.run(pagoSql, [cuentaId, montoAbono, descuentoAplicado, metodo_pago, notas]);
                    
                    const updateCuentaSql = `UPDATE cuentas_por_pagar SET estado = ? WHERE id = ?`;
                    db.run(updateCuentaSql, [nuevoEstado, cuentaId]);
                    
                    db.run('COMMIT', (commitErr) => {
                        if (commitErr) { db.run('ROLLBACK'); return res.status(500).json({ error: commitErr.message }); }
                        res.json({ message: "Pago registrado con éxito." });
                    });
                });
            });
        });

        app.get('/api/reportes/ventas', authenticateToken, (req, res) => {
            const inicio = req.query.inicio ? `${req.query.inicio} 00:00:00` : '1970-01-01 00:00:00';
            const fin = req.query.fin ? `${req.query.fin} 23:59:59` : new Date().toISOString();
            const params = [inicio, fin];
            const summarySql = `
                SELECT
                    SUM(v.total) as totalIngresos,
                    (SELECT COALESCE(SUM(vi.costo_unitario * vi.cantidad), 0) FROM venta_items vi JOIN ventas v_join ON vi.venta_id = v_join.id WHERE v_join.fecha_venta BETWEEN ? AND ?) as totalCostos
                FROM ventas v
                WHERE v.fecha_venta BETWEEN ? AND ?
            `;
            const detailsSql = `SELECT * FROM ventas WHERE fecha_venta BETWEEN ? AND ? ORDER BY fecha_venta DESC`;
            db.get(summarySql, [inicio, fin, inicio, fin], (err, summary) => {
                if (err) return res.status(500).json({ error: err.message });
                db.all(detailsSql, params, (err, details) => {
                    if (err) return res.status(500).json({ error: err.message });
                    const totalIngresos = summary.totalIngresos || 0;
                    const totalCostos = summary.totalCostos || 0;
                    res.json({
                        message: "success",
                        data: {
                            summary: {
                                totalIngresos: totalIngresos,
                                totalCostos: totalCostos,
                                gananciaBruta: totalIngresos - totalCostos
                            },
                            details: details
                        }
                    });
                });
            });
        });
        
        app.get('/api/configuracion', authenticateToken, (req, res) => {
            const jsonDir = path.join(__dirname, '..', 'frontend', 'json');
            const companyFile = path.join(jsonPath, 'empresa.json');
            const policiesFile = path.join(jsonPath, 'politicas.json');

            try {
                const companyData = JSON.parse(fs.readFileSync(companyFile, 'utf8'));
                const policiesData = JSON.parse(fs.readFileSync(policiesFile, 'utf8'));
                res.json({
                    message: "success",
                    data: {
                        ...companyData,
                        politicas: policiesData
                    }
                });
            } catch (error) {
                res.status(500).json({ error: "Error al leer los archivos de configuración." });
            }
        });
        app.put('/api/configuracion', authenticateToken, uploadLogo.single('logo_file'), (req, res) => {
            const { nombre_empresa, direccion_empresa, telefono_empresa, politicas } = req.body;
            
            const companyData = { nombre_empresa, direccion_empresa, telefono_empresa };
            const policiesData = Array.isArray(politicas) ? politicas : (politicas || '').split('\n').filter(p => p.trim() !== '');

            const jsonDir = path.join(__dirname, '..', 'frontend', 'json');
            const companyFile = path.join(jsonPath, 'empresa.json');
            const policiesFile = path.join(jsonPath, 'politicas.json');

            try {
    fs.writeFileSync(companyFile, JSON.stringify(companyData, null, 2));
    fs.writeFileSync(policiesFile, JSON.stringify(policiesData, null, 2));
    res.json({ message: "Configuración guardada con éxito." });
} catch (error) {
    res.status(500).json({ error: "Error al guardar los archivos de configuración." });
}
        });

        // --- RUTAS DE USUARIOS ---
        app.get('/api/usuarios', authenticateToken, (req, res) => {
            const sql = "SELECT id, nombre, usuario, rol, estado FROM usuarios ORDER BY nombre ASC";
            db.all(sql, [], (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: "success", data: rows });
            });
        });
        app.post('/api/usuarios', authenticateToken, async (req, res) => {
            const { nombre, usuario, password, rol } = req.body;
            if (!nombre || !usuario || !password || !rol) {
                return res.status(400).json({ error: "Todos los campos son obligatorios." });
            }
            try {
                const hashedPassword = await bcrypt.hash(password, 10);
                const sql = "INSERT INTO usuarios (nombre, usuario, password, rol) VALUES (?, ?, ?, ?)";
                db.run(sql, [nombre, usuario, hashedPassword, rol], function(err) {
                    if (err) {
                        if (err.message.includes("UNIQUE constraint failed")) return res.status(409).json({ error: "El nombre de usuario ya existe." });
                        return res.status(500).json({ error: err.message });
                    }
                    res.status(201).json({ message: "Usuario creado con éxito.", data: { id: this.lastID } });
                });
            } catch (error) {
                res.status(500).json({ error: "Error al encriptar la contraseña." });
            }
        });
        app.put('/api/usuarios/:id', authenticateToken, (req, res) => {
            const { estado } = req.body;
            if (!estado || !['activo', 'inactivo'].includes(estado)) {
                return res.status(400).json({ error: "El estado debe ser 'activo' o 'inactivo'." });
            }
            if (req.params.id === '1') {
                return res.status(403).json({ error: "No se puede cambiar el estado del administrador principal." });
            }
            const sql = "UPDATE usuarios SET estado = ? WHERE id = ?";
            db.run(sql, [estado, req.params.id], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                if (this.changes === 0) return res.status(404).json({ error: "Usuario no encontrado." });
                res.json({ message: "Estado del usuario actualizado con éxito." });
            });
        });
        app.delete('/api/usuarios/:id', authenticateToken, (req, res) => {
            if (req.params.id === '1') {
                return res.status(403).json({ error: "No se puede eliminar al administrador principal." });
            }
            const sql = "DELETE FROM usuarios WHERE id = ?";
            db.run(sql, [req.params.id], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                if (this.changes === 0) return res.status(404).json({ error: "Usuario no encontrado." });
                res.json({ message: "Usuario eliminado con éxito." });
            });
        });
        
        // Iniciar el servidor
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`--- Servidor iniciado y escuchando en http://localhost:${PORT} y en la red local ---`);
            createAdminUser();
            ensureConfigFilesExist();
        });

    } catch (err) {
        console.error("No se pudo iniciar el servidor:", err);
        process.exit(1);
    }
};

startServer();