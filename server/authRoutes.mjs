// authRoutes.mjs
import express from 'express';
import bcrypt from 'bcrypt';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import dotenv from 'dotenv';
import os from 'os';
import path from 'path';

dotenv.config();

const router = express.Router();

// ✅ Use the same DB path as in db.mjs
const dbPath = path.join(os.homedir(), '.smarti_data', 'test_results.db');

// Set up SQLite database connection (users table must already exist)
const dbPromise = open({
  filename: dbPath,
  driver: sqlite3.Database,
});

// Helper function to hash passwords
const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

// 🔐 Login route
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const db = await dbPromise;
    console.log("🔍 Attempting to find user:", username);

    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);

    if (!user) {
      console.log('❌ Invalid username');
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    console.log("✅ User found:", user);

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      console.log('❌ Invalid password');
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    req.session.user = { id: user.id, username: user.username, role: user.role };
    console.log('👤 User authenticated:', req.session.user);

    res.status(200).json({ message: 'Login successful', user: req.session.user });
  } catch (error) {
    console.error('💥 Error in login route:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 📝 User registration route
router.post('/register', async (req, res) => {
  const { username, password, role, secretKey } = req.body;

  if (secretKey !== process.env.SECRET_KEY) {
    return res.status(403).json({ message: 'Invalid secret key' });
  }

  try {
    const db = await dbPromise;

    const existingUser = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (existingUser) {
      console.log('⚠️ Username already exists:', username);
      return res.status(409).json({ message: 'Username already taken' });
    }

    const hashedPassword = await hashPassword(password);
    await db.run(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hashedPassword, role]
    );
    console.log('✅ User registered successfully:', username);

    res.status(201).json({ message: `User ${username} created with role ${role}` });
  } catch (error) {
    console.error('💥 Error during registration:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
