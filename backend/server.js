const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const bankingRoutes = require('./routes/banking');
const { startSettlementWorker } = require('./settlement');
const {
  TRUST_PROXY,
  addSecurityHeaders,
  rejectSpoofedIpHeaders,
} = require('./security');

dotenv.config();
const app = express();

connectDB().then(startSettlementWorker);

app.set('trust proxy', TRUST_PROXY);
app.disable('x-powered-by');
app.use(addSecurityHeaders);
app.use(rejectSpoofedIpHeaders);
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use('/api/auth', authRoutes);
app.use('/api/banking', bankingRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Secure banking backend is running' });
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  return res.status(500).json({ message: 'Unexpected server error.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
