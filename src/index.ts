import express from 'express';
import cors from 'cors';
import { config } from './config';
import { logger } from './utils/logger';
import { PolymarketClient } from './clients/polymarketClient';
import { OrderbookMonitor } from './services/orderbookMonitor';
import { InventoryManager } from './services/inventoryManager';
import { MarketMaker } from './services/marketMaker';
import { initializeRoutes } from './routes/api';

async function main() {
  logger.info('Starting Polymarket Market Maker Bot...');

  // Initialize clients and services
  const client = new PolymarketClient();
  await client.initializeApiCredentials();

  const orderbookMonitor = new OrderbookMonitor(client);
  const inventoryManager = new InventoryManager(client);
  const marketMaker = new MarketMaker(client, orderbookMonitor, inventoryManager);

  // Start inventory manager
  inventoryManager.start();

  // Initialize Express app
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    next();
  });

  // Routes
  app.use('/api', initializeRoutes(client, orderbookMonitor, inventoryManager, marketMaker));

  // Root route
  app.get('/', (req, res) => {
    res.json({
      name: 'Polymarket Market Maker Bot',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        health: '/api/health',
        status: '/api/status',
        markets: '/api/markets',
        positions: '/api/positions',
        orders: '/api/orders',
      },
    });
  });

  // Error handling
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      path: req.path,
    });

    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
    });
  });

  // Start server
  const port = config.server.port;
  app.listen(port, () => {
    logger.info(`Server running on port ${port}`);
    logger.info(`API available at http://localhost:${port}/api`);
    logger.info(`Health check: http://localhost:${port}/api/health`);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    orderbookMonitor.stopAll();
    inventoryManager.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    orderbookMonitor.stopAll();
    inventoryManager.stop();
    process.exit(0);
  });
}

// Start the application
main().catch((error) => {
  logger.error('Failed to start application', { error });
  process.exit(1);
});

