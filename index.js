const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const stock = require('./routes/stock');
const pedidos = require('./routes/pedidos');
const comprobantesRouter = require('./routes/comprobante');


const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api', dashboardRoutes);
app.use('/api/', stock);
app.use('/api/', pedidos)
app.use('/api/comprobante', comprobantesRouter);



const PORT = 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
