const express = require('express');
const pool = require('../db');
const router = express.Router();

// =============================
// Obtener todos los pedidos con sus productos Y TELÉFONO
// =============================
router.get('/pedidos', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        p.id_pedido,
        DATE_FORMAT(p.fecha_creacion, '%d/%m/%Y') AS fecha,
        u.nombre AS cliente,
        COALESCE(p.telefono_contacto, u.telefono, 'Sin teléfono') AS telefono,
        GROUP_CONCAT(CONCAT(d.cantidad, 'kg x ', s.nombre) SEPARATOR ', ') AS productos,
        p.total,
        e.nombre_estado AS estado
      FROM Pedidos p
      INNER JOIN Usuarios u ON p.id_usuario = u.id_usuario
      INNER JOIN Pedido_producto d ON p.id_pedido = d.id_pedido
      INNER JOIN Stock s ON d.id_producto = s.id_producto
      INNER JOIN Estado e ON p.id_estado = e.id_estado
      GROUP BY p.id_pedido
      ORDER BY p.fecha_creacion DESC;
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error al obtener los pedidos:', error);
    res.status(500).json({ error: 'Error al obtener los pedidos' });
  }
});

// =============================
// Crear un nuevo pedido CON TELÉFONO
// =============================
router.post('/pedidos', async (req, res) => {
  try {
    const { id_usuario, productos, total, id_estado, telefono } = req.body;

    if (!id_usuario || !productos || productos.length === 0 || !total) {
      return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    // Crear el pedido con teléfono
    const [pedidoResult] = await pool.query(
      `INSERT INTO Pedidos (id_usuario, fecha_creacion, total, telefono_contacto, id_estado) 
       VALUES (?, NOW(), ?, ?, ?)`,
      [id_usuario, total, telefono || null, id_estado || 1]
    );

    const id_pedido = pedidoResult.insertId;

    // Insertar los productos del pedido
    for (const producto of productos) {
      await pool.query(
        `INSERT INTO Pedido_producto (id_pedido, id_producto, cantidad) VALUES (?, ?, ?)`,
        [id_pedido, producto.id_producto, producto.cantidad]
      );
    }

    res.status(201).json({ mensaje: 'Pedido creado correctamente', id_pedido });
  } catch (error) {
    console.error('Error al crear el pedido:', error);
    res.status(500).json({ error: 'Error al crear el pedido' });
  }
});

// =============================
// Actualizar el estado o total de un pedido
// CON ACTUALIZACIÓN AUTOMÁTICA DE STOCK Y REGISTRO DE VENTA
// =============================
router.put('/pedidos/:id', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;
    const { id_estado, total } = req.body;

    await connection.beginTransaction();

    // Obtener el estado actual del pedido y su total
    const [pedidoActual] = await connection.query(
      `SELECT id_estado, total FROM Pedidos WHERE id_pedido = ?`,
      [id]
    );

    if (pedidoActual.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const estadoAnterior = pedidoActual[0].id_estado;
    const totalPedido = pedidoActual[0].total;

    // Actualizar el pedido
    await connection.query(
      `UPDATE Pedidos SET id_estado = COALESCE(?, id_estado), total = COALESCE(?, total) WHERE id_pedido = ?`,
      [id_estado, total, id]
    );

    // Si el nuevo estado es "Entregado" (id_estado = 4) y el anterior NO era entregado
    if (id_estado && parseInt(id_estado) === 4 && estadoAnterior !== 4) {
      // Obtener todos los productos del pedido
      const [productos] = await connection.query(
        `SELECT id_producto, cantidad FROM Pedido_producto WHERE id_pedido = ?`,
        [id]
      );

      // Actualizar el stock de cada producto
      for (const producto of productos) {
        // Verificar que hay suficiente stock
        const [stockActual] = await connection.query(
          `SELECT cantidad_disponible FROM Stock WHERE id_producto = ?`,
          [producto.id_producto]
        );

        if (stockActual.length === 0) {
          await connection.rollback();
          return res.status(400).json({ 
            error: `Producto con ID ${producto.id_producto} no encontrado en stock` 
          });
        }

        if (stockActual[0].cantidad_disponible < producto.cantidad) {
          await connection.rollback();
          return res.status(400).json({ 
            error: `Stock insuficiente para el producto ID ${producto.id_producto}. Disponible: ${stockActual[0].cantidad_disponible}, Requerido: ${producto.cantidad}` 
          });
        }

        // Restar la cantidad del stock
        await connection.query(
          `UPDATE Stock SET cantidad_disponible = cantidad_disponible - ? WHERE id_producto = ?`,
          [producto.cantidad, producto.id_producto]
        );
      }

      // REGISTRAR LA VENTA AUTOMÁTICAMENTE
      // Verificar si ya existe una venta para este pedido
      const [ventaExistente] = await connection.query(
        `SELECT id_venta FROM Ventas WHERE id_pedido = ?`,
        [id]
      );

      if (ventaExistente.length === 0) {
        // Crear registro de venta (método de pago por defecto: Efectivo = 1)
        await connection.query(
          `INSERT INTO Ventas (fecha_pago, monto, total, id_pedido, id_metodo) 
           VALUES (CURDATE(), ?, ?, ?, ?)`,
          [totalPedido, totalPedido, id, 1]
        );
        console.log(`✅ Venta registrada automáticamente para pedido ${id}: $${totalPedido}`);
      }

      console.log(`Stock actualizado para pedido ${id}: ${productos.length} productos descontados`);
    }

    // Si se está cambiando DE "Entregado" a otro estado
    if (id_estado && parseInt(id_estado) !== 4 && estadoAnterior === 4) {
      // Obtener todos los productos del pedido
      const [productos] = await connection.query(
        `SELECT id_producto, cantidad FROM Pedido_producto WHERE id_pedido = ?`,
        [id]
      );

      // Devolver el stock de cada producto
      for (const producto of productos) {
        await connection.query(
          `UPDATE Stock SET cantidad_disponible = cantidad_disponible + ? WHERE id_producto = ?`,
          [producto.cantidad, producto.id_producto]
        );
      }

      // ELIMINAR LA VENTA si existe
      await connection.query(
        `DELETE FROM Ventas WHERE id_pedido = ?`,
        [id]
      );

      console.log(`Stock devuelto y venta eliminada para pedido ${id}`);
    }

    await connection.commit();
    res.json({ 
      mensaje: 'Pedido actualizado correctamente',
      stock_actualizado: id_estado && parseInt(id_estado) === 4 && estadoAnterior !== 4,
      venta_registrada: id_estado && parseInt(id_estado) === 4 && estadoAnterior !== 4
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error al actualizar el pedido:', error);
    res.status(500).json({ error: 'Error al actualizar el pedido' });
  } finally {
    connection.release();
  }
});

// =============================
// Eliminar un pedido
// =============================
router.delete('/pedidos/:id', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;

    await connection.beginTransaction();

    // Verificar si el pedido está entregado
    const [pedido] = await connection.query(
      `SELECT id_estado FROM Pedidos WHERE id_pedido = ?`,
      [id]
    );

    if (pedido.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // Si el pedido estaba entregado (id_estado = 4), devolver el stock
    if (pedido[0].id_estado === 4) {
      const [productos] = await connection.query(
        `SELECT id_producto, cantidad FROM Pedido_producto WHERE id_pedido = ?`,
        [id]
      );

      for (const producto of productos) {
        await connection.query(
          `UPDATE Stock SET cantidad_disponible = cantidad_disponible + ? WHERE id_producto = ?`,
          [producto.cantidad, producto.id_producto]
        );
      }

      // Eliminar la venta asociada
      await connection.query(`DELETE FROM Ventas WHERE id_pedido = ?`, [id]);
    }

    // Eliminar los productos del pedido
    await connection.query(`DELETE FROM Pedido_producto WHERE id_pedido = ?`, [id]);
    
    // Eliminar el pedido
    await connection.query(`DELETE FROM Pedidos WHERE id_pedido = ?`, [id]);

    await connection.commit();
    res.json({ mensaje: 'Pedido eliminado correctamente' });

  } catch (error) {
    await connection.rollback();
    console.error('Error al eliminar el pedido:', error);
    res.status(500).json({ error: 'Error al eliminar el pedido' });
  } finally {
    connection.release();
  }
});

module.exports = router;