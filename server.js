const express = require("express");
const { Pool } = require("pg");

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
})

// Test the connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully:', res.rows[0]);
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { unit, pin } = req.body;
    
    const result = await pool.query(
      'SELECT * FROM login WHERE unit = $1',
      [unit]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Unit not found' });
    }
    
    const user = result.rows[0];
    
    if (user.pin === pin) {
      return res.json({ success: true, message: 'Login successful', unit: user.unit });
    } else {
      return res.status(401).json({ success: false, error: 'Invalid PIN' });
    }
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// Get unit details
app.get('/api/unit/:unitNumber', async (req, res) => {
  try {
    const unitNumber = req.params.unitNumber;
    
    const result = await pool.query(
      'SELECT * FROM units WHERE unit_number = $1',
      [unitNumber]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Unit details not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// Get payment history for a unit
app.get('/api/unit/:unitNumber/history', async (req, res) => {
  try {
    const unitNumber = req.params.unitNumber;
    
    const result = await pool.query(
      'SELECT * FROM payment_history WHERE unit_number = $1 ORDER BY month_year DESC',
      [unitNumber]
    );
    
    res.json({ success: true, data: result.rows });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// ADMIN ENDPOINTS

// Get all units
app.get('/api/admin/units', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM units ORDER BY unit_number');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// Get current month data
app.get('/api/admin/month/:monthYear', async (req, res) => {
  try {
    const monthYear = req.params.monthYear;
    const result = await pool.query(
      'SELECT * FROM payment_history WHERE month_year = $1 ORDER BY unit_number',
      [monthYear]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// Auto-generate current month billing
app.post('/api/admin/generate-month', async (req, res) => {
  try {
    const { month_year } = req.body;
    
    // Check if already exists
    const existing = await pool.query(
      'SELECT COUNT(*) FROM payment_history WHERE month_year = $1',
      [month_year]
    );
    
    if (parseInt(existing.rows[0].count) > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Billing for this month already exists' 
      });
    }
    
    // Get all units
    const units = await pool.query('SELECT * FROM units ORDER BY unit_number');
    
    // Generate random water bills for each unit
    const insertPromises = units.rows.map(unit => {
      const waterBill = (Math.random() * (60 - 35) + 35).toFixed(2);
      return pool.query(
        'INSERT INTO payment_history (unit_number, month_year, rent, water_bill, status) VALUES ($1, $2, $3, $4, $5)',
        [unit.unit_number, month_year, unit.rent, waterBill, 'pending']
      );
    });
    
    await Promise.all(insertPromises);
    
    res.json({ success: true, message: 'Month billing generated successfully' });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// Update payment record
app.put('/api/admin/payment/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { rent, water_bill, maintenance, status, paid_date, payment_method } = req.body;
    
    const result = await pool.query(
      'UPDATE payment_history SET rent = $1, water_bill = $2, maintenance = $3, status = $4, paid_date = $5, payment_method = $6 WHERE id = $7 RETURNING *',
      [rent, water_bill, maintenance, status, paid_date, payment_method, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Payment record not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// Update base unit info
app.put('/api/admin/unit/:unitNumber', async (req, res) => {
  try {
    const unitNumber = req.params.unitNumber;
    const updates = req.body;
    
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((field, i) => `${field} = ${i + 1}`).join(', ');
    
    const result = await pool.query(
      `UPDATE units SET ${setClause} WHERE unit_number = ${fields.length + 1} RETURNING *`,
      [...values, unitNumber]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Unit not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// WATER MANAGEMENT ENDPOINTS

// Get water summary for a month
app.get('/api/water/summary/:monthYear', async (req, res) => {
  try {
    const monthYear = req.params.monthYear;
    
    const result = await pool.query(
      'SELECT COUNT(*) as total_tankers, SUM(liters) as total_liters, SUM(cost) as total_cost FROM water_tankers WHERE month_year = $1',
      [monthYear]
    );
    
    const data = result.rows[0];
    const totalLiters = parseInt(data.total_liters) || 0;
    const totalCost = parseFloat(data.total_cost) || 0;
    const pricePerLiter = totalLiters > 0 ? totalCost / totalLiters : 0;
    
    res.json({
      success: true,
      data: {
        total_tankers: parseInt(data.total_tankers) || 0,
        total_liters: totalLiters,
        total_cost: totalCost,
        price_per_liter: pricePerLiter
      }
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// Get all tankers
app.get('/api/water/tankers', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM water_tankers ORDER BY tanker_date DESC'
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// Add tanker
app.post('/api/water/tanker', async (req, res) => {
  try {
    const { month_year, tanker_date, liters, cost, notes } = req.body;
    
    const result = await pool.query(
      'INSERT INTO water_tankers (month_year, tanker_date, liters, cost, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [month_year, tanker_date, liters, cost, notes]
    );
    
    res.json({ success: true, data: result.rows[0] });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// Delete tanker
app.delete('/api/water/tanker/:id', async (req, res) => {
  try {
    const id = req.params.id;
    
    await pool.query('DELETE FROM water_tankers WHERE id = $1', [id]);
    
    res.json({ success: true });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// Get meter readings for a month
app.get('/api/water/readings/:monthYear', async (req, res) => {
  try {
    const monthYear = req.params.monthYear;
    
    const result = await pool.query(
      'SELECT * FROM water_meter_readings WHERE month_year = $1 ORDER BY unit_number',
      [monthYear]
    );
    
    res.json({ success: true, data: result.rows });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// Update meter reading
app.put('/api/water/reading/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const updates = req.body;
    
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((field, i) => `${field} = ${i + 1}`).join(', ');
    
    const result = await pool.query(
      `UPDATE water_meter_readings SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ${fields.length + 1} RETURNING *`,
      [...values, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Reading not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// Calculate and update water bills
app.post('/api/water/calculate-bills', async (req, res) => {
  try {
    const { month_year } = req.body;
    
    // Get price per liter
    const summaryResult = await pool.query(
      'SELECT SUM(liters) as total_liters, SUM(cost) as total_cost FROM water_tankers WHERE month_year = $1',
      [month_year]
    );
    
    const totalLiters = parseInt(summaryResult.rows[0].total_liters) || 0;
    const totalCost = parseFloat(summaryResult.rows[0].total_cost) || 0;
    
    if (totalLiters === 0) {
      return res.status(400).json({ success: false, error: 'No tanker data available for this month' });
    }
    
    const pricePerLiter = totalCost / totalLiters;
    
    // Get all meter readings
    const readingsResult = await pool.query(
      'SELECT * FROM water_meter_readings WHERE month_year = $1',
      [month_year]
    );
    
    // Update water bills for each unit
    const updatePromises = readingsResult.rows.map(reading => {
      const waterBill = reading.liters_consumed * pricePerLiter;
      return pool.query(
        'UPDATE payment_history SET water_bill = $1 WHERE unit_number = $2 AND month_year = $3',
        [waterBill, reading.unit_number, month_year]
      );
    });
    
    await Promise.all(updatePromises);
    
    res.json({ success: true, message: 'Water bills calculated and updated' });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});