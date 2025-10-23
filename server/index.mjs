// server/index.mjs
import express from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './authRoutes.mjs';
import uploadRoutes from './uploadRoute.mjs';
import fileRoutes from './fileManagementRoutes.mjs';
import db from './db.mjs';  // ensures DB initializes once

const app = express();

// middlewares
app.use(cors());
app.use(express.json());

// routes
app.use('/auth', authRoutes);
app.use('/upload', uploadRoutes);
app.use('/files', fileRoutes);

// serve React build if needed (optional fallback)
const clientBuild = path.resolve('client', 'build');
app.use(express.static(clientBuild));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuild, 'index.html'));
});

// start server
const PORT = 3002;
app.listen(PORT, () => {
  console.log(`🚀 Express server running at http://localhost:${PORT}`);
});
