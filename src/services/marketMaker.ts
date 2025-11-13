import { PolymarketClient } from '../clients/polymarketClient';
import { OrderbookMonitor, OrderbookSnapshot } from './orderbookMonitor';
import { InventoryManager } from './inventoryManager';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Market, Quote, MarketMakerConfig } from '../types';

export interface ActiveMarket {
  market: Market;
  config: MarketMakerConfig;
  yesTokenId: string;
  noTokenId: string;
  orders: Set<string>; // Order IDs
  lastUpdate: number;
}

export class MarketMaker {
  private client: PolymarketClient;
  private orderbookMonitor: OrderbookMonitor;
  private inventoryManager: InventoryManager;
  private activeMarkets: Map<string, ActiveMarket> = new Map();
  private running: boolean = false;
  private updateInterval?: NodeJS.Timeout;

  constructor(
    client: PolymarketClient,
    orderbookMonitor: OrderbookMonitor,
    inventoryManager: InventoryManager
  ) {
    this.client = client;
    this.orderbookMonitor = orderbookMonitor;
    this.inventoryManager = inventoryManager;
  }

  /**
   * Start market making for a market
   */
  async startMarketMaking(marketId: string, customConfig?: Partial<MarketMakerConfig>): Promise<boolean> {
    try {
      // Get market info
      const market = await this.client.getMarket(marketId);
      if (!market) {
        logger.error(`Market ${marketId} not found`);
        return false;
      }

      if (market.clobTokenIds.length < 2) {
        logger.error(`Market ${marketId} does not have enough tokens`);
        return false;
      }

      const yesTokenId = market.clobTokenIds[0];
      const noTokenId = market.clobTokenIds[1];

      const marketConfig: MarketMakerConfig = {
        spreadBps: customConfig?.spreadBps || config.strategy.defaultSpreadBps,
        orderSizeUsd: customConfig?.orderSizeUsd || config.strategy.defaultOrderSizeUsd,
        maxPositionSizeUsd: customConfig?.maxPositionSizeUsd || config.strategy.maxPositionSizeUsd,
        maxInventoryImbalance: customConfig?.maxInventoryImbalance || config.strategy.maxInventoryImbalance,
      };

      const activeMarket: ActiveMarket = {
        market,
        config: marketConfig,
        yesTokenId,
        noTokenId,
        orders: new Set(),
        lastUpdate: Date.now(),
      };

      this.activeMarkets.set(marketId, activeMarket);

      // Start monitoring orderbooks
      this.orderbookMonitor.startMonitoring([yesTokenId, noTokenId], config.strategy.orderRefreshIntervalMs);

      // Subscribe to orderbook updates
      this.orderbookMonitor.subscribe(yesTokenId, () => this.updateQuotes(marketId));
      this.orderbookMonitor.subscribe(noTokenId, () => this.updateQuotes(marketId));

      // Start update loop if not already running
      if (!this.running) {
        this.start();
      }

      logger.info(`Started market making for market ${marketId}: ${market.question}`);
      await this.updateQuotes(marketId); // Initial quote placement

      return true;
    } catch (error: any) {
      logger.error(`Failed to start market making for ${marketId}`, {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Stop market making for a market
   */
  async stopMarketMaking(marketId: string): Promise<boolean> {
    try {
      const activeMarket = this.activeMarkets.get(marketId);
      if (!activeMarket) {
        return false;
      }

      // Cancel all orders
      await this.cancelAllOrders(marketId);

      // Stop monitoring
      this.orderbookMonitor.stopMonitoring(activeMarket.yesTokenId);
      this.orderbookMonitor.stopMonitoring(activeMarket.noTokenId);

      this.activeMarkets.delete(marketId);

      logger.info(`Stopped market making for market ${marketId}`);

      // Stop update loop if no active markets
      if (this.activeMarkets.size === 0) {
        this.stop();
      }

      return true;
    } catch (error: any) {
      logger.error(`Failed to stop market making for ${marketId}`, {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Start the update loop
   */
  private start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.updateInterval = setInterval(() => {
      this.updateAllQuotes();
    }, config.strategy.orderRefreshIntervalMs);

    logger.info('Started market maker update loop');
  }

  /**
   * Stop the update loop
   */
  private stop(): void {
    if (!this.running) {
      return;
    }

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }

    this.running = false;
    logger.info('Stopped market maker update loop');
  }

  /**
   * Update quotes for all active markets
   */
  private async updateAllQuotes(): Promise<void> {
    const updatePromises = Array.from(this.activeMarkets.keys()).map((marketId) =>
      this.updateQuotes(marketId)
    );
    await Promise.all(updatePromises);
  }

  /**
   * Update quotes for a specific market
   */
  private async updateQuotes(marketId: string): Promise<void> {
    const activeMarket = this.activeMarkets.get(marketId);
    if (!activeMarket) {
      return;
    }

    try {
      // Check risk limits
      if (!this.checkRiskLimits(marketId)) {
        logger.warn(`Risk limits exceeded for market ${marketId}, skipping quote update`);
        return;
      }

      // Get current orderbook snapshots
      const yesSnapshot = this.orderbookMonitor.getSnapshot(activeMarket.yesTokenId);
      const noSnapshot = this.orderbookMonitor.getSnapshot(activeMarket.noTokenId);

      if (!yesSnapshot || !noSnapshot) {
        logger.debug(`Orderbook data not available for market ${marketId}`);
        return;
      }

      // Calculate quotes
      const yesQuotes = this.calculateQuotes(
        yesSnapshot,
        activeMarket.config,
        'YES',
        marketId
      );
      const noQuotes = this.calculateQuotes(
        noSnapshot,
        activeMarket.config,
        'NO',
        marketId
      );

      // Cancel existing orders
      await this.cancelAllOrders(marketId);

      // Place new orders
      for (const quote of [...yesQuotes, ...noQuotes]) {
        const order = await this.client.placeOrder(
          quote.tokenId,
          quote.side,
          quote.price,
          quote.size
        );

        if (order) {
          activeMarket.orders.add(order.id);
        }
      }

      activeMarket.lastUpdate = Date.now();
    } catch (error: any) {
      logger.error(`Failed to update quotes for market ${marketId}`, {
        error: error.message,
      });
    }
  }

  /**
   * Calculate quotes based on orderbook and inventory
   */
  private calculateQuotes(
    snapshot: OrderbookSnapshot,
    marketConfig: MarketMakerConfig,
    outcome: 'YES' | 'NO',
    marketId: string
  ): Quote[] {
    const quotes: Quote[] = [];

    if (!snapshot.midPrice) {
      return quotes;
    }

    // Get inventory imbalance - need conditionId from market
    const activeMarket = this.activeMarkets.get(marketId);
    if (!activeMarket) {
      return quotes;
    }
    
    const inventory = this.inventoryManager.getInventory(activeMarket.market.conditionId);
    const imbalance = this.inventoryManager.getInventoryImbalance(activeMarket.market.conditionId);

    // Calculate spread in price terms
    const spread = (snapshot.midPrice * marketConfig.spreadBps) / 10000;

    // Adjust spread based on inventory imbalance
    // If we're long YES, widen YES ask and narrow YES bid
    let adjustedSpreadBps = marketConfig.spreadBps;
    if (Math.abs(imbalance) > 0.3) {
      // Widen spread when inventory is imbalanced
      adjustedSpreadBps = marketConfig.spreadBps * 1.5;
    }

    const adjustedSpread = (snapshot.midPrice * adjustedSpreadBps) / 10000;

    // Calculate bid and ask prices
    const bidPrice = snapshot.midPrice - adjustedSpread / 2;
    const askPrice = snapshot.midPrice + adjustedSpread / 2;

    // Calculate order size in tokens (approximate)
    const orderSizeTokens = marketConfig.orderSizeUsd / snapshot.midPrice;

    // Adjust order sizes based on inventory
    // If we're long, reduce buy orders and increase sell orders
    let buySize = orderSizeTokens;
    let sellSize = orderSizeTokens;

    if (outcome === 'YES') {
      if (imbalance > 0.2) {
        // Long YES, reduce YES buys
        buySize *= 0.5;
        sellSize *= 1.5;
      } else if (imbalance < -0.2) {
        // Short YES, increase YES buys
        buySize *= 1.5;
        sellSize *= 0.5;
      }
    } else {
      // NO outcome
      if (imbalance < -0.2) {
        // Long NO (short YES), reduce NO buys
        buySize *= 0.5;
        sellSize *= 1.5;
      } else if (imbalance > 0.2) {
        // Short NO (long YES), increase NO buys
        buySize *= 1.5;
        sellSize *= 0.5;
      }
    }

    // Place bid (buy) order
    quotes.push({
      side: 'BUY',
      price: bidPrice.toFixed(6),
      size: buySize.toFixed(6),
      tokenId: snapshot.tokenId,
    });

    // Place ask (sell) order
    quotes.push({
      side: 'SELL',
      price: askPrice.toFixed(6),
      size: sellSize.toFixed(6),
      tokenId: snapshot.tokenId,
    });

    return quotes;
  }

  /**
   * Cancel all orders for a market
   */
  private async cancelAllOrders(marketId: string): Promise<void> {
    const activeMarket = this.activeMarkets.get(marketId);
    if (!activeMarket) {
      return;
    }

    const cancelPromises = Array.from(activeMarket.orders).map((orderId) =>
      this.client.cancelOrder(orderId)
    );

    await Promise.all(cancelPromises);
    activeMarket.orders.clear();
  }

  /**
   * Check risk limits
   */
  private checkRiskLimits(marketId: string): boolean {
    if (!config.risk.enableRiskLimits) {
      return true;
    }

    const activeMarket = this.activeMarkets.get(marketId);
    if (!activeMarket) {
      return false;
    }

    // Check inventory imbalance
    const imbalance = Math.abs(
      this.inventoryManager.getInventoryImbalance(activeMarket.market.conditionId)
    );
    if (imbalance > activeMarket.config.maxInventoryImbalance) {
      return false;
    }

    // Check position size
    const inventory = this.inventoryManager.getInventory(activeMarket.market.conditionId);
    const totalValue = inventory.yesValue + inventory.noValue;
    if (totalValue > activeMarket.config.maxPositionSizeUsd) {
      return false;
    }

    // Check total exposure
    const allPositions = this.inventoryManager.getAllPositions();
    const totalExposure = allPositions.reduce((sum, pos) => {
      return sum + parseFloat(pos.curPrice || '0') * parseFloat(pos.size || '0');
    }, 0);

    if (totalExposure > config.risk.maxTotalExposureUsd) {
      return false;
    }

    return true;
  }

  /**
   * Get active markets
   */
  getActiveMarkets(): ActiveMarket[] {
    return Array.from(this.activeMarkets.values());
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      running: this.running,
      activeMarkets: this.activeMarkets.size,
      markets: Array.from(this.activeMarkets.entries()).map(([id, market]) => ({
        marketId: id,
        question: market.market.question,
        orders: market.orders.size,
        lastUpdate: market.lastUpdate,
      })),
    };
  }
}

