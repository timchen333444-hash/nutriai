const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth.js');
const foodRoutes = require('./routes/foods.js');
const logRoutes = require('./routes/log.js');
const waterRoutes = require('./routes/water.js');
const aiRoutes = require('./routes/ai.js');
const insightsRoutes = require('./routes/insights.js');
const barcodeRoutes = require('./routes/barcode.js');
const usdaRoutes = require('./routes/usda.js');
const plansRoutes = require('./routes/plans.js');
const weightRoutes = require('./routes/weight.js');
const templatesRoutes = require('./routes/templates.js');
const recipesRoutes = require('./routes/recipes.js');
const supplementsRoutes = require('./routes/supplements.js');
const groceryRoutes     = require('./routes/grocery.js');
const alertsRoutes      = require('./routes/alerts.js');
const communityRoutes   = require('./routes/community.js');
const integrationsRoutes = require('./routes/integrations.js');
const fitnessRoutes      = require('./routes/fitness.js');
const nutritionRoutes    = require('./routes/nutrition.js');
const usageRoutes        = require('./routes/usage.js');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://nutriai-lime.vercel.app',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow server-to-server requests (no origin) and any listed origin
    if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, true);
    else cb(new Error(`CORS: origin ${origin} not allowed`));
  },
}));
app.use(express.json({ limit: '20mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/foods', foodRoutes);
app.use('/api/log', logRoutes);
app.use('/api/water', waterRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/barcode', barcodeRoutes);
app.use('/api/usda', usdaRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/weight',    weightRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/recipes',     recipesRoutes);
app.use('/api/supplements', supplementsRoutes);
app.use('/api/grocery',    groceryRoutes);
app.use('/api/alerts',        alertsRoutes);
app.use('/api/community',     communityRoutes);
app.use('/api/integrations',  integrationsRoutes);
app.use('/api/fitness',       fitnessRoutes);
app.use('/api/nutrition',    nutritionRoutes);
app.use('/api/usage',        usageRoutes);

app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

const startServer = (port) => {
  const server = app.listen(port, () => {
    console.log(`NutriAI API running on port ${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} busy, trying ${port + 1}...`);
      startServer(port + 1);
    }
  });

  process.on('SIGINT', () => {
    server.close(() => {
      console.log('Server shut down cleanly');
      process.exit(0);
    });
  });
};

startServer(parseInt(process.env.PORT) || 3001);
