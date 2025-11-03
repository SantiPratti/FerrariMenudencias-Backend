const express = require('express');
const PDFDocument = require('pdfkit');
const pool = require('../db');

const router = express.Router();

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  

  try {
    const [rows] = await pool.query(`
      SELECT 
        p.id_pedido,
        u.nombre AS nombre_cliente,
        p.total,
        p.fecha_creacion AS fecha,
        GROUP_CONCAT(CONCAT(pp.cantidad, 'kg x ', s.nombre) SEPARATOR ', ') AS productos
      FROM Pedidos p
      INNER JOIN Usuarios u ON p.id_usuario = u.id_usuario
      LEFT JOIN Pedido_producto pp ON p.id_pedido = pp.id_pedido
      LEFT JOIN Stock s ON pp.id_producto = s.id_producto
      WHERE p.id_pedido = ?
      GROUP BY p.id_pedido
    `, [id]);


    if (rows.length === 0) {
      console.log('Pedido no encontrado');
      return res.status(404).json({ error: 'Comprobante no encontrado' });
    }

    const pedido = rows[0];

    res.setHeader('Content-disposition', `attachment; filename=comprobante_${id}.pdf`);
    res.setHeader('Content-type', 'application/pdf');

    const doc = new PDFDocument();
    doc.pipe(res);

    doc.fontSize(20).text('Ferrari Menudencias', { align: 'center' });
    doc.moveDown();
    doc.fontSize(18).text('Comprobante de Pedido', { align: 'center' });
    doc.moveDown(2);
    
    doc.fontSize(12);
    doc.text(`Número de Pedido: ${pedido.id_pedido}`);
    doc.text(`Cliente: ${pedido.nombre_cliente}`);
    doc.text(`Fecha: ${new Date(pedido.fecha).toLocaleDateString('es-AR')}`);
    doc.moveDown();
    
    doc.text('Productos:');
    doc.text(pedido.productos || 'Sin productos');
    doc.moveDown();
    
    doc.fontSize(14).text(`Total: $${parseFloat(pedido.total).toFixed(2)}`, { bold: true });
    doc.moveDown(2);
    doc.fontSize(10).text('¡Gracias por su compra!', { align: 'center' });

    doc.end();
    

  } catch (error) {
    console.error('Error al generar comprobante:', error);
    res.status(500).json({ error: 'Error al generar el comprobante', details: error.message });
  }
});

module.exports = router;