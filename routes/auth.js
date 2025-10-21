const express = require('express');
const pool = require('../db');

const router = express.Router();

// Registro simple
router.post('/register', async (req, res) => {
  const { nombre, email, password, id_rol } = req.body;
  try {
    const [existing] = await pool.query('SELECT * FROM Usuarios WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(400).json({ error: 'Usuario ya existe' });

    await pool.query(
      'INSERT INTO Usuarios (nombre, contraseña, email, id_rol) VALUES (?, ?, ?, ?)',
      [nombre, password, email, id_rol]
    );

    res.json({ message: 'Usuario registrado con éxito' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// Login simple
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [users] = await pool.query('SELECT * FROM Usuarios WHERE email = ? AND contraseña = ?', [email, password]);
    if (users.length === 0) return res.status(400).json({ error: 'Usuario o contraseña incorrecta' });

    res.json({ message: 'Login exitoso', user: users[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

module.exports = router;
