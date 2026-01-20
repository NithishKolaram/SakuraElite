const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");
const Razorpay = require('razorpay');
const crypto = require('crypto');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from current directory
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/home.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

app.get('/water-management.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'water-management.html'));
});

app.get('/maintenance-management.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'maintenance-management.html'));
});

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
    
    console.log('Login attempt:', { unit, pin: pin ? '***' : 'empty' });
    
    const result = await pool.query(
      'SELECT * FROM login WHERE unit = $1',
      [unit]
    );
    
    if (result.rows.length === 0) {
      console.log('Unit not found:', unit);
      return res.status(404).json({ success: false, error: 'Unit not found' });
    }
    
    const user = result.rows[0];
    console.log('Found user:', user.unit, 'Checking PIN...');
    
    const dbPin = parseInt(user.pin, 10);
    const inputPin = parseInt(pin, 10);
    
    console.log('PIN comparison - DB type:', typeof dbPin, 'Input type:', typeof inputPin, 'Match:', dbPin === inputPin);
    
    if (dbPin === inputPin) {
      console.log('✓ Login successful for:', unit);
      return res.json({ success: true, message: 'Login successful', unit: user.unit });
    } else {
      console.log('Invalid PIN for:', unit, '- DB:', dbPin, 'Input:', inputPin);
      return res.status(401).json({ success: false, error: 'Invalid PIN' });
    }
    
  } catch (err) {
    console.error('Login error:', err);
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

// Update unit details (for unit users)
app.put('/api/unit/:unitNumber/update', async (req, res) => {
  try {
    const unitNumber = req.params.unitNumber;
    const updates = req.body;
    
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');
    
    const result = await pool.query(
      `UPDATE units SET ${setClause} WHERE unit_number = $${fields.length + 1} RETURNING *`,
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
app.get('/api/admin/month', async (req, res) => {
  try {
    const monthYear = req.query.monthYear;
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

// Auto-generate current month billing with corpus
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
      const maintenance = 0;
      const corpus = 0;
      return pool.query(
        'INSERT INTO payment_history (unit_number, month_year, rent, water_bill, maintenance, corpus, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [unit.unit_number, month_year, unit.rent, waterBill, maintenance, corpus, 'pending']
      );
    });
    
    await Promise.all(insertPromises);
    
    res.json({ success: true, message: 'Month billing generated successfully' });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// Update payment record with corpus support
app.put('/api/admin/payment/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const updates = req.body;
    
    // Get current record to merge updates
    const current = await pool.query('SELECT * FROM payment_history WHERE id = $1', [id]);
    
    if (current.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Payment record not found' });
    }
    
    const currentData = current.rows[0];
    const merged = { ...currentData, ...updates };
    
    const result = await pool.query(
      'UPDATE payment_history SET rent = $1, water_bill = $2, maintenance = $3, corpus = $4, status = $5, paid_date = $6, payment_method = $7 WHERE id = $8 RETURNING *',
      [merged.rent, merged.water_bill, merged.maintenance || 0, merged.corpus || 0, merged.status, merged.paid_date, merged.payment_method, id]
    );
    
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
    const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');
    
    const result = await pool.query(
      `UPDATE units SET ${setClause} WHERE unit_number = $${fields.length + 1} RETURNING *`,
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
app.get('/api/water/summary', async (req, res) => {
  try {
    const monthYear = req.query.monthYear;
    
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
app.get('/api/water/readings', async (req, res) => {
  try {
    const monthYear = req.query.monthYear;
    
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
    const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');
    
    const result = await pool.query(
      `UPDATE water_meter_readings SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${fields.length + 1} RETURNING *`,
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

// MAINTENANCE MANAGEMENT ENDPOINTS

// Get maintenance balance for a month with breakdown
app.get('/api/maintenance/balance', async (req, res) => {
  try {
    const monthYear = req.query.monthYear;
    
    // Calculate from PAID records only
    const collectedResult = await pool.query(
      'SELECT SUM(maintenance) as maintenance_total, SUM(corpus) as corpus_total FROM payment_history WHERE month_year = $1 AND status = $2',
      [monthYear, 'paid']
    );
    
    const maintenanceCollected = parseFloat(collectedResult.rows[0].maintenance_total) || 0;
    const corpusCollected = parseFloat(collectedResult.rows[0].corpus_total) || 0;
    const totalCollected = maintenanceCollected + corpusCollected;
    
    // Get existing balance record
    let result = await pool.query(
      'SELECT * FROM maintenance_balance WHERE month_year = $1',
      [monthYear]
    );
    
    // Get total expenses
    const expensesResult = await pool.query(
      'SELECT SUM(amount) as total_expenses FROM maintenance_expenses WHERE month_year = $1',
      [monthYear]
    );
    const totalExpenses = parseFloat(expensesResult.rows[0].total_expenses) || 0;
    
    // Calculate closing balance
    const openingBalance = result.rows.length > 0 ? parseFloat(result.rows[0].opening_balance) : 0;
    const closingBalance = openingBalance + totalCollected - totalExpenses;
    
    // Create or update balance record
    if (result.rows.length === 0) {
      await pool.query(
        'INSERT INTO maintenance_balance (month_year, opening_balance, total_collected, total_expenses, closing_balance, maintenance_collected, corpus_collected) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [monthYear, openingBalance, totalCollected, totalExpenses, closingBalance, maintenanceCollected, corpusCollected]
      );
    } else {
      await pool.query(
        'UPDATE maintenance_balance SET total_collected = $1, total_expenses = $2, closing_balance = $3, maintenance_collected = $4, corpus_collected = $5, updated_at = CURRENT_TIMESTAMP WHERE month_year = $6',
        [totalCollected, totalExpenses, closingBalance, maintenanceCollected, corpusCollected, monthYear]
      );
    }
    
    result = await pool.query(
      'SELECT * FROM maintenance_balance WHERE month_year = $1',
      [monthYear]
    );
    
    res.json({ success: true, data: result.rows[0] });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// FIXED: Refresh collected amount - SUM MAINTENANCE AND CORPUS from PAID records only
app.post('/api/maintenance/refresh-collected', async (req, res) => {
  try {
    const { month_year } = req.body;
    
    // Sum maintenance and corpus from PAID records only
    const collectedResult = await pool.query(
      'SELECT SUM(maintenance) as maintenance_total, SUM(corpus) as corpus_total FROM payment_history WHERE month_year = $1 AND status = $2',
      [month_year, 'paid']
    );
    
    const maintenanceCollected = parseFloat(collectedResult.rows[0].maintenance_total) || 0;
    const corpusCollected = parseFloat(collectedResult.rows[0].corpus_total) || 0;
    const totalCollected = maintenanceCollected + corpusCollected;
    
    // Get total expenses
    const expensesResult = await pool.query(
      'SELECT SUM(amount) as total_expenses FROM maintenance_expenses WHERE month_year = $1',
      [month_year]
    );
    const totalExpenses = parseFloat(expensesResult.rows[0].total_expenses) || 0;
    
    // Get current balance data
    const balanceResult = await pool.query(
      'SELECT * FROM maintenance_balance WHERE month_year = $1',
      [month_year]
    );
    
    const openingBalance = balanceResult.rows.length > 0 ? parseFloat(balanceResult.rows[0].opening_balance) : 0;
    const closingBalance = openingBalance + totalCollected - totalExpenses;
    
    // Update or insert with breakdown
    await pool.query(
      `INSERT INTO maintenance_balance (month_year, opening_balance, total_collected, total_expenses, closing_balance, maintenance_collected, corpus_collected)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (month_year) 
       DO UPDATE SET total_collected = $3, total_expenses = $4, closing_balance = $5, maintenance_collected = $6, corpus_collected = $7, updated_at = CURRENT_TIMESTAMP`,
      [month_year, openingBalance, totalCollected, totalExpenses, closingBalance, maintenanceCollected, corpusCollected]
    );
    
    res.json({ 
      success: true, 
      data: { 
        total_collected: totalCollected, 
        maintenance_collected: maintenanceCollected,
        corpus_collected: corpusCollected,
        closing_balance: closingBalance 
      } 
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// Carry forward balance to next month
app.post('/api/maintenance/carry-forward', async (req, res) => {
  try {
    const { month_year } = req.body;
    
    // Get current month balance
    const currentResult = await pool.query(
      'SELECT * FROM maintenance_balance WHERE month_year = $1',
      [month_year]
    );
    
    if (currentResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'No balance found for current month' });
    }
    
    const currentBalance = currentResult.rows[0];
    const closingBalance = parseFloat(currentBalance.closing_balance);
    
    // Mark current month as carried forward
    await pool.query(
      'UPDATE maintenance_balance SET carried_forward = true WHERE month_year = $1',
      [month_year]
    );
    
    // Calculate next month
    const [month, year] = month_year.split('/');
    const nextMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
    const nextYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
    const nextMonthYear = `${String(nextMonth).padStart(2, '0')}/${nextYear}`;
    
    // Create or update next month with opening balance
    await pool.query(
      `INSERT INTO maintenance_balance (month_year, opening_balance, total_collected, total_expenses, closing_balance)
       VALUES ($1, $2, 0, 0, $2)
       ON CONFLICT (month_year)
       DO UPDATE SET opening_balance = $2, closing_balance = maintenance_balance.total_collected - maintenance_balance.total_expenses + $2`,
      [nextMonthYear, closingBalance]
    );
    
    res.json({ success: true, message: 'Balance carried forward successfully' });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// Get expenses for a month
app.get('/api/maintenance/expenses', async (req, res) => {
  try {
    const monthYear = req.query.monthYear;
    
    const result = await pool.query(
      'SELECT * FROM maintenance_expenses WHERE month_year = $1 ORDER BY expense_date DESC',
      [monthYear]
    );
    
    res.json({ success: true, data: result.rows });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// Get all expenses
app.get('/api/maintenance/expenses/all', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM maintenance_expenses ORDER BY expense_date DESC'
    );
    
    res.json({ success: true, data: result.rows });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// Add expense
app.post('/api/maintenance/expense', async (req, res) => {
  try {
    const { month_year, expense_date, description, amount, category, notes } = req.body;
    
    // Insert expense
    const result = await pool.query(
      'INSERT INTO maintenance_expenses (month_year, expense_date, description, amount, category, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [month_year, expense_date, description, amount, category, notes]
    );
    
    // Update maintenance balance
    const balanceResult = await pool.query(
      'SELECT * FROM maintenance_balance WHERE month_year = $1',
      [month_year]
    );
    
    const openingBalance = balanceResult.rows.length > 0 ? parseFloat(balanceResult.rows[0].opening_balance) : 0;
    const totalCollected = balanceResult.rows.length > 0 ? parseFloat(balanceResult.rows[0].total_collected) : 0;
    
    // Calculate new total expenses
    const expensesResult = await pool.query(
      'SELECT SUM(amount) as total FROM maintenance_expenses WHERE month_year = $1',
      [month_year]
    );
    const totalExpenses = parseFloat(expensesResult.rows[0].total) || 0;
    const closingBalance = openingBalance + totalCollected - totalExpenses;
    
    // Update balance
    await pool.query(
      `INSERT INTO maintenance_balance (month_year, opening_balance, total_collected, total_expenses, closing_balance)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (month_year)
       DO UPDATE SET total_expenses = $4, closing_balance = $5, updated_at = CURRENT_TIMESTAMP`,
      [month_year, openingBalance, totalCollected, totalExpenses, closingBalance]
    );
    
    res.json({ success: true, data: result.rows[0] });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// Delete expense
app.delete('/api/maintenance/expense/:id', async (req, res) => {
  try {
    const id = req.params.id;
    
    // Get expense details before deleting
    const expenseResult = await pool.query('SELECT * FROM maintenance_expenses WHERE id = $1', [id]);
    
    if (expenseResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Expense not found' });
    }
    
    const expense = expenseResult.rows[0];
    const monthYear = expense.month_year;
    
    // Delete expense
    await pool.query('DELETE FROM maintenance_expenses WHERE id = $1', [id]);
    
    // Recalculate balance
    const balanceResult = await pool.query(
      'SELECT * FROM maintenance_balance WHERE month_year = $1',
      [monthYear]
    );
    
    const openingBalance = balanceResult.rows.length > 0 ? parseFloat(balanceResult.rows[0].opening_balance) : 0;
    const totalCollected = balanceResult.rows.length > 0 ? parseFloat(balanceResult.rows[0].total_collected) : 0;
    
    // Calculate new total expenses
    const expensesResult = await pool.query(
      'SELECT SUM(amount) as total FROM maintenance_expenses WHERE month_year = $1',
      [monthYear]
    );
    const totalExpenses = parseFloat(expensesResult.rows[0].total) || 0;
    const closingBalance = openingBalance + totalCollected - totalExpenses;
    
    // Update balance
    await pool.query(
      'UPDATE maintenance_balance SET total_expenses = $1, closing_balance = $2, updated_at = CURRENT_TIMESTAMP WHERE month_year = $3',
      [totalExpenses, closingBalance, monthYear]
    );
    
    res.json({ success: true });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// Test endpoint for payment API
app.get('/api/payment/test', (req, res) => {
  res.json({ success: true, message: 'Payment API is working' });
});

app.post('/api/payment/create-order', async (req, res) => {
  try {
    const { amount, unit_number, payment_id, month_year } = req.body;
    
    console.log('Create order request:', { payment_id, unit_number, month_year });
    
    // Get payment details
    const paymentResult = await pool.query(
      'SELECT * FROM payment_history WHERE id = $1 AND unit_number = $2',
      [payment_id, unit_number]
    );
    
    if (paymentResult.rows.length === 0) {
      console.log('Payment not found:', payment_id, unit_number);
      return res.status(404).json({ success: false, error: 'Payment record not found' });
    }
    
    const payment = paymentResult.rows[0];
    const totalAmount = parseFloat(payment.rent) + parseFloat(payment.water_bill) + 
                       parseFloat(payment.maintenance || 0) + parseFloat(payment.corpus || 0);
    
    console.log('Payment details:', { totalAmount, status: payment.status });
    
    // Create Razorpay order
    const options = {
      amount: Math.round(totalAmount * 100), // Amount in paise
      currency: 'INR',
      receipt: `receipt_${payment_id}_${Date.now()}`,
      notes: {
        unit_number: unit_number,
        payment_id: payment_id,
        month_year: month_year
      }
    };
    
    const order = await razorpay.orders.create(options);
    
    console.log('Razorpay order created:', order.id);
    
    res.json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID
    });
    
  } catch (error) {
    console.error('Error creating order:', error.message);
    res.status(500).json({ success: false, error: 'Failed to create payment order: ' + error.message });
  }
});

// Verify Razorpay payment signature and update database
app.post('/api/payment/verify', async (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      payment_id,
      unit_number
    } = req.body;
    
    // Verify signature
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest('hex');
    
    if (razorpay_signature !== expectedSign) {
      return res.status(400).json({ success: false, error: 'Invalid payment signature' });
    }
    
    // Signature is valid, update payment status in database
    const paid_date = new Date().toISOString().split('T')[0];
    
    const result = await pool.query(
      `UPDATE payment_history 
       SET status = 'paid', 
           paid_date = $1, 
           payment_method = 'Razorpay',
           razorpay_order_id = $2,
           razorpay_payment_id = $3
       WHERE id = $4 AND unit_number = $5
       RETURNING *`,
      [paid_date, razorpay_order_id, razorpay_payment_id, payment_id, unit_number]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Payment record not found' });
    }
    
    // Also update maintenance balance if maintenance/corpus was paid
    const payment = result.rows[0];
    const maintenanceAmount = parseFloat(payment.maintenance || 0);
    const corpusAmount = parseFloat(payment.corpus || 0);
    
    if (maintenanceAmount > 0 || corpusAmount > 0) {
      // Refresh maintenance collected amounts
      await fetch('http://localhost:3000/api/maintenance/refresh-collected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month_year: payment.month_year })
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Payment verified and recorded successfully',
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ success: false, error: 'Failed to verify payment' });
  }
});

// Get payment details for a specific month
app.get('/api/payment/details/:unitNumber/:monthYear', async (req, res) => {
  try {
    const { unitNumber, monthYear } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM payment_history WHERE unit_number = $1 AND month_year = $2',
      [unitNumber, monthYear]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Payment record not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// server.js - Add this function before the app.listen() section

// Function to check and auto-generate new month billing
async function checkAndGenerateNewMonth() {
  try {
    const now = new Date();
    const currentMonth = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    
    console.log(`Checking for month generation: ${currentMonth}`);
    
    // Check if billing exists for current month
    const existing = await pool.query(
      'SELECT COUNT(*) FROM payment_history WHERE month_year = $1',
      [currentMonth]
    );
    
    if (parseInt(existing.rows[0].count) === 0) {
      console.log(`Generating billing for ${currentMonth}...`);
      
      // Check if we should carry forward balances from previous month
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const previousMonthStr = `${String(previousMonth.getMonth() + 1).padStart(2, '0')}/${previousMonth.getFullYear()}`;
      
      // Get all units
      const units = await pool.query('SELECT * FROM units ORDER BY unit_number');
      
      // Generate billing for each unit
      const insertPromises = units.rows.map(async (unit) => {
        // Calculate water bill based on average or fixed amount
        const waterBill = (Math.random() * (60 - 35) + 35).toFixed(2);
        
        // Check for previous month's unpaid maintenance/corpus to carry forward
        const previousPayment = await pool.query(
          'SELECT * FROM payment_history WHERE unit_number = $1 AND month_year = $2',
          [unit.unit_number, previousMonthStr]
        );
        
        let maintenance = 0;
        let corpus = 0;
        
        // If previous month exists and was unpaid, carry forward maintenance/corpus
        if (previousPayment.rows.length > 0 && previousPayment.rows[0].status === 'pending') {
          const prev = previousPayment.rows[0];
          maintenance = parseFloat(prev.maintenance) || 0;
          corpus = parseFloat(prev.corpus) || 0;
          
          console.log(`Carrying forward for ${unit.unit_number}: M=${maintenance}, C=${corpus}`);
        }
        
        return pool.query(
          'INSERT INTO payment_history (unit_number, month_year, rent, water_bill, maintenance, corpus, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [unit.unit_number, currentMonth, unit.rent, waterBill, maintenance, corpus, 'pending']
        );
      });
      
      await Promise.all(insertPromises);
      console.log(`✓ Auto-generated billing for ${currentMonth}`);
      
      // Also carry forward maintenance balance
      await autoCarryForwardMaintenance(previousMonthStr, currentMonth);
    }
  } catch (err) {
    console.error('Error in auto-month generation:', err);
  }
}

// Function to auto-carry forward maintenance balance
async function autoCarryForwardMaintenance(fromMonth, toMonth) {
  try {
    // Get current month balance
    const currentResult = await pool.query(
      'SELECT * FROM maintenance_balance WHERE month_year = $1',
      [fromMonth]
    );
    
    if (currentResult.rows.length > 0) {
      const currentBalance = currentResult.rows[0];
      const closingBalance = parseFloat(currentBalance.closing_balance);
      
      // Mark current month as carried forward
      await pool.query(
        'UPDATE maintenance_balance SET carried_forward = true WHERE month_year = $1',
        [fromMonth]
      );
      
      // Create or update next month with opening balance
      await pool.query(
        `INSERT INTO maintenance_balance (month_year, opening_balance, total_collected, total_expenses, closing_balance)
         VALUES ($1, $2, 0, 0, $2)
         ON CONFLICT (month_year)
         DO UPDATE SET opening_balance = $2, closing_balance = maintenance_balance.total_collected - maintenance_balance.total_expenses + $2`,
        [toMonth, closingBalance]
      );
      
      console.log(`✓ Auto-carried forward maintenance balance from ${fromMonth} to ${toMonth}: ${closingBalance}`);
    }
  } catch (err) {
    console.error('Error in auto-carry forward:', err);
  }
}

// Check for new month generation on server start
setTimeout(() => {
  checkAndGenerateNewMonth();
}, 2000);

// Also check daily at 00:05 AM
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() === 5) {
    checkAndGenerateNewMonth();
  }
}, 60000); // Check every minute

// Add this endpoint to manually trigger month generation
app.post('/api/admin/auto-generate-check', async (req, res) => {
  try {
    await checkAndGenerateNewMonth();
    res.json({ success: true, message: 'Month generation check completed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser to access the application`);
});