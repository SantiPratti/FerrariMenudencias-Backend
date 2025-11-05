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

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    const primaryColor = '#2c3e50';
    const accentColor = '#e74c3c';
    const lightGray = '#ecf0f1';
    const darkGray = '#7f8c8d';

    doc.rect(0, 0, doc.page.width, 120).fill(primaryColor);
    
    doc.fillColor('#ffffff')
       .fontSize(28)
       .font('Helvetica-Bold')
       .text('Ferrari Menudencias', 50, 35, { align: 'center' });
    
    doc.fontSize(14)
       .font('Helvetica')
       .text('Comprobante de Pedido', { align: 'center' });
    
    doc.moveTo(50, 95)
       .lineTo(doc.page.width - 50, 95)
       .strokeColor('#ffffff')
       .lineWidth(2)
       .stroke();

    doc.fillColor(primaryColor)
       .fontSize(10)
       .font('Helvetica')
       .text(`Nº ${String(pedido.id_pedido).padStart(6, '0')}`, doc.page.width - 150, 40, {
         width: 100,
         align: 'right'
       });

    doc.y = 150;

    doc.roundedRect(50, doc.y, doc.page.width - 100, 90, 5)
       .fillAndStroke(lightGray, darkGray);
    
    const infoY = doc.y + 20;
    doc.fillColor(primaryColor)
       .fontSize(11)
       .font('Helvetica-Bold')
       .text('INFORMACIÓN DEL PEDIDO', 70, infoY);
    
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor(darkGray);
    
    doc.text('Cliente:', 70, infoY + 25);
    doc.fillColor(primaryColor)
       .font('Helvetica-Bold')
       .text(pedido.nombre_cliente, 140, infoY + 25);
    
    doc.fillColor(darkGray)
       .font('Helvetica')
       .text('Fecha:', 70, infoY + 45);
    doc.fillColor(primaryColor)
       .font('Helvetica-Bold')
       .text(new Date(pedido.fecha).toLocaleDateString('es-AR', {
         day: '2-digit',
         month: 'long',
         year: 'numeric'
       }), 140, infoY + 45);

    doc.y = infoY + 110;
    doc.fillColor(primaryColor)
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('DETALLE DE PRODUCTOS', 50, doc.y);
    
    doc.moveTo(50, doc.y + 20)
       .lineTo(doc.page.width - 50, doc.y + 20)
       .strokeColor(accentColor)
       .lineWidth(2)
       .stroke();

    doc.y += 35;
    
    const productos = pedido.productos ? pedido.productos.split(', ') : ['Sin productos'];
    productos.forEach((producto, index) => {
      doc.fillColor(primaryColor)
         .fontSize(10)
         .font('Helvetica')
         .text(`• ${producto}`, 70, doc.y);
      doc.y += 20;
    });

    doc.y += 10;

    const totalY = doc.y;
    doc.roundedRect(doc.page.width - 250, totalY, 200, 60, 5)
       .fill(accentColor);
    
    doc.fillColor('#ffffff')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('TOTAL', doc.page.width - 230, totalY + 15);
    
    doc.fontSize(20)
       .text(`$${parseFloat(pedido.total).toFixed(2)}`, doc.page.width - 230, totalY + 33);

    doc.y = doc.page.height - 120;
    
    doc.moveTo(50, doc.y)
       .lineTo(doc.page.width - 50, doc.y)
       .strokeColor(lightGray)
       .lineWidth(1)
       .stroke();
    
    doc.fillColor(darkGray)
       .fontSize(10)
       .font('Helvetica-Oblique')
       .text('¡Gracias por su compra!', 50, doc.y + 20, {
         align: 'center',
         width: doc.page.width - 100
       });
    
    doc.fontSize(8)
       .font('Helvetica')
       .text('Ferrari Menudencias - Productos de calidad', 50, doc.y + 40, {
         align: 'center',
         width: doc.page.width - 100
       });

    doc.end();

  } catch (error) {
    console.error('Error al generar comprobante:', error);
    res.status(500).json({ error: 'Error al generar el comprobante', details: error.message });
  }
});

module.exports = router;