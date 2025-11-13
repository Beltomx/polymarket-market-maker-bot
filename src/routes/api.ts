import { Router, Request, Response } from 'express';
import { PolymarketClient } from '../clients/polymarketClient';
import { OrderbookMonitor } from '../services/orderbookMonitor';
import { InventoryManager } from '../services/inventoryManager';
import { MarketMaker } from '../services/marketMaker';
import { logger } from '../utils/logger';

const router = Router();

// Initialize services (these would typically be injected via dependency injection)
let client: PolymarketClient;
let orderbookMonitor: OrderbookMonitor;
let inventoryManager: InventoryManager;
let marketMaker: MarketMaker;

export function initializeRoutes(
  polymarketClient: PolymarketClient,
  obMonitor: OrderbookMonitor,
  invManager: InventoryManager,
  mm: MarketMaker
): Router {
  client = polymarketClient;
  orderbookMonitor = obMonitor;
  inventoryManager = invManager;
  marketMaker = mm;

  return router;
}

// Health check
router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Get bot status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = marketMaker.getStatus();
    const positions = inventoryManager.getAllPositions();
    const totalExposure = positions.reduce((sum, pos) => {
      return sum + parseFloat(pos.curPrice || '0') * parseFloat(pos.size || '0');
    }, 0);

    res.json({
      ...status,
      totalPositions: positions.length,
      totalExposureUsd: totalExposure,
    });
  } catch (error: any) {
    logger.error('Failed to get status', { error: error.message });
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// Start market making for a market
router.post('/markets/:marketId/start', async (req: Request, res: Response) => {
  try {
    const { marketId } = req.params;
    const config = req.body;

    const success = await marketMaker.startMarketMaking(marketId, config);

    if (success) {
      res.json({ success: true, message: `Started market making for ${marketId}` });
    } else {
      res.status(400).json({ success: false, error: 'Failed to start market making' });
    }
  } catch (error: any) {
    logger.error('Failed to start market making', { error: error.message });
    res.status(500).json({ error: 'Failed to start market making' });
  }
});

// Stop market making for a market
router.post('/markets/:marketId/stop', async (req: Request, res: Response) => {
  try {
    const { marketId } = req.params;
    const success = await marketMaker.stopMarketMaking(marketId);

    if (success) {
      res.json({ success: true, message: `Stopped market making for ${marketId}` });
    } else {
      res.status(400).json({ success: false, error: 'Market not found or already stopped' });
    }
  } catch (error: any) {
    logger.error('Failed to stop market making', { error: error.message });
    res.status(500).json({ error: 'Failed to stop market making' });
  }
});

// Get active markets
router.get('/markets', async (req: Request, res: Response) => {
  try {
    const activeMarkets = marketMaker.getActiveMarkets();
    res.json({
      count: activeMarkets.length,
      markets: activeMarkets.map((am) => ({
        marketId: am.market.id,
        question: am.market.question,
        slug: am.market.slug,
        active: am.market.active,
        orders: am.orders.size,
        config: am.config,
        lastUpdate: am.lastUpdate,
      })),
    });
  } catch (error: any) {
    logger.error('Failed to get markets', { error: error.message });
    res.status(500).json({ error: 'Failed to get markets' });
  }
});

// Get positions
router.get('/positions', async (req: Request, res: Response) => {
  try {
    const positions = inventoryManager.getAllPositions();
    res.json({
      count: positions.length,
      positions: positions.map((pos) => ({
        conditionId: pos.conditionId,
        outcome: pos.outcome,
        size: pos.size,
        avgPrice: pos.avgPrice,
        curPrice: pos.curPrice,
        cashPnl: pos.cashPnl,
        percentPnl: pos.percentPnl,
      })),
    });
  } catch (error: any) {
    logger.error('Failed to get positions', { error: error.message });
    res.status(500).json({ error: 'Failed to get positions' });
  }
});

// Get orders
router.get('/orders', async (req: Request, res: Response) => {
  try {
    const orders = await client.getOrders();
    res.json({
      count: orders.length,
      orders: orders.map((order) => ({
        id: order.id,
        marketId: order.marketId,
        tokenId: order.tokenId,
        side: order.side,
        price: order.price,
        size: order.size,
        filled: order.filled,
        status: order.status,
        createdAt: order.createdAt,
      })),
    });
  } catch (error: any) {
    logger.error('Failed to get orders', { error: error.message });
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

// Get orderbook snapshot
router.get('/orderbook/:tokenId', async (req: Request, res: Response) => {
  try {
    const { tokenId } = req.params;
    const snapshot = orderbookMonitor.getSnapshot(tokenId);

    if (!snapshot) {
      res.status(404).json({ error: 'Orderbook snapshot not found' });
      return;
    }

    res.json({
      tokenId: snapshot.tokenId,
      bestBid: snapshot.bestBid,
      bestAsk: snapshot.bestAsk,
      midPrice: snapshot.midPrice,
      spread: snapshot.spread,
      spreadBps: snapshot.spreadBps,
      timestamp: snapshot.timestamp,
      orderbook: snapshot.orderbook,
    });
  } catch (error: any) {
    logger.error('Failed to get orderbook', { error: error.message });
    res.status(500).json({ error: 'Failed to get orderbook' });
  }
});

// Get inventory for a market
router.get('/inventory/:conditionId', async (req: Request, res: Response) => {
  try {
    const { conditionId } = req.params;
    const inventory = inventoryManager.getInventory(conditionId);
    const imbalance = inventoryManager.getInventoryImbalance(conditionId);

    res.json({
      conditionId,
      inventory,
      imbalance,
      isBalanced: inventoryManager.isInventoryBalanced(
        conditionId,
        0.6 // Default max imbalance
      ),
    });
  } catch (error: any) {
    logger.error('Failed to get inventory', { error: error.message });
    res.status(500).json({ error: 'Failed to get inventory' });
  }
});

// Update configuration
router.post('/config', async (req: Request, res: Response) => {
  try {
    // This would update the config and restart services if needed
    // For now, just return success
    logger.info('Configuration update requested', { body: req.body });
    res.json({ success: true, message: 'Configuration update not fully implemented' });
  } catch (error: any) {
    logger.error('Failed to update config', { error: error.message });
    res.status(500).json({ error: 'Failed to update config' });
  }
});

export default router;

