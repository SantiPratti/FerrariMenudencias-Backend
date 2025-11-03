const express = require('express');
const pool = require('../db'); 
const router = express.Router();


router.get('/stock', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        id_producto,
        nombre,
        cantidad_disponible AS stock_actual,
        stock_minimo,
        precio
      FROM Stock
    `);

    const data = rows.map(p => ({
      ...p,
      estado: p.stock_actual <= 0 ? 'Sin stock'
        : p.stock_actual < p.stock_minimo ? 'Bajo stock'
        : 'Stock normal'
    }));

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener el stock', details: err.message });
  }
});


router.post('/stock', async (req, res) => {
  try {
    const { nombre, cantidad_disponible, stock_minimo, precio } = req.body;

    if (!nombre || cantidad_disponible === undefined || stock_minimo === undefined || precio === undefined) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    await pool.query(
      `INSERT INTO Stock (nombre, cantidad_disponible, stock_minimo, precio)
       VALUES (?, ?, ?, ?)`,
      [nombre, cantidad_disponible, stock_minimo, precio]
    );

    res.json({ message: 'Producto agregado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al agregar producto', details: err.message });
  }
});


router.put('/stock/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, cantidad_disponible, stock_minimo, precio } = req.body;

    await pool.query(
      `UPDATE Stock 
       SET nombre = ?, cantidad_disponible = ?, stock_minimo = ?, precio = ?
       WHERE id_producto = ?`,
      [nombre, cantidad_disponible, stock_minimo, precio, id]
    );

    res.json({ message: 'Producto actualizado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar producto', details: err.message });
  }
});


router.delete('/stock/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(`DELETE FROM Stock WHERE id_producto = ?`, [id]);
    res.json({ message: 'Producto eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar producto', details: err.message });
  }
});

module.exports = router;