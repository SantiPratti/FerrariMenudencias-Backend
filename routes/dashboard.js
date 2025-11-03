const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/dashboard', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
          p.id_pedido AS id_pedido,
          s.nombre AS producto,
          e.nombre_estado AS estado_pedido,
          s.cantidad_disponible,
          CASE
              WHEN s.cantidad_disponible > 10 THEN 'OK'
              WHEN s.cantidad_disponible BETWEEN 1 AND 10 THEN 'Falta stock'
              WHEN s.cantidad_disponible = 0 THEN 'Sin stock'
              ELSE 'Desconocido'
          END AS estado_stock
      FROM Pedidos p
      INNER JOIN Pedido_producto pp ON p.id_pedido = pp.id_pedido
      INNER JOIN Stock s ON pp.id_producto = s.id_producto
      INNER JOIN Estado e ON p.id_estado = e.id_estado
      ORDER BY p.id_pedido;
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error al obtener los pedidos:', error);
    res.status(500).json({ error: 'Error al obtener los pedidos' });
  }
});

router.get('/dashboard/pendientes', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
          p.id_pedido AS id_pedido,
          s.nombre AS producto,
          e.nombre_estado AS estado_pedido,
          s.cantidad_disponible,
          CASE
              WHEN s.cantidad_disponible > 10 THEN 'OK'
              WHEN s.cantidad_disponible BETWEEN 1 AND 10 THEN 'Falta stock'
              WHEN s.cantidad_disponible = 0 THEN 'Sin stock'
              ELSE 'Desconocido'
          END AS estado_stock
      FROM Pedidos p
      INNER JOIN Pedido_producto pp ON p.id_pedido = pp.id_pedido
      INNER JOIN Stock s ON pp.id_producto = s.id_producto
      INNER JOIN Estado e ON p.id_estado = e.id_estado
      WHERE e.nombre_estado = 'Pendiente'
      ORDER BY p.id_pedido;
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error al obtener los pedidos pendientes:', error);
    res.status(500).json({ error: 'Error al obtener los pedidos pendientes' });
  }
});

router.get('/dashboard/ventas-diarias', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
          COALESCE(SUM(monto), 0) AS total_ventas_hoy
      FROM Ventas
      WHERE fecha_pago = CURDATE();
    `); 
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener las ventas diarias:', error);
    res.status(500).json({ error: 'Error al obtener las ventas diarias' });
  }
});

router.get('/estados', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
          id_estado,
          nombre_estado
      FROM Estado
      ORDER BY id_estado;
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error al obtener los estados:', error);
    res.status(500).json({ error: 'Error al obtener los estados' });
  }
});

module.exports = router;