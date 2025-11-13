import { PolymarketClient } from '../clients/polymarketClient';
import { logger } from '../utils/logger';
import { Orderbook } from '../types';

export interface OrderbookSnapshot {
  tokenId: string;
  orderbook: Orderbook;
  timestamp: number;
  bestBid?: number;
  bestAsk?: number;
  midPrice?: number;
  spread?: number;
  spreadBps?: number;
}

export class OrderbookMonitor {
  private client: PolymarketClient;
  private snapshots: Map<string, OrderbookSnapshot> = new Map();
  private updateCallbacks: Map<string, Set<(snapshot: OrderbookSnapshot) => void>> = new Map();
  private monitoring: Set<string> = new Set();
  private updateInterval?: NodeJS.Timeout;

  constructor(client: PolymarketClient) {
    this.client = client;
  }

  /**
   * Start monitoring orderbooks for given tokens
   */
  startMonitoring(tokenIds: string[], intervalMs: number = 5000): void {
    tokenIds.forEach((tokenId) => {
      this.monitoring.add(tokenId);
    });

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(() => {
      this.updateOrderbooks();
    }, intervalMs);

    logger.info(`Started monitoring ${tokenIds.length} tokens`);
    this.updateOrderbooks(); // Initial update
  }

  /**
   * Stop monitoring a token
   */
  stopMonitoring(tokenId: string): void {
    this.monitoring.delete(tokenId);
    this.snapshots.delete(tokenId);
    logger.info(`Stopped monitoring token ${tokenId}`);
  }

  /**
   * Stop all monitoring
   */
  stopAll(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
    this.monitoring.clear();
    this.snapshots.clear();
    logger.info('Stopped all orderbook monitoring');
  }

  /**
   * Subscribe to orderbook updates for a token
   */
  subscribe(tokenId: string, callback: (snapshot: OrderbookSnapshot) => void): () => void {
    if (!this.updateCallbacks.has(tokenId)) {
      this.updateCallbacks.set(tokenId, new Set());
    }
    this.updateCallbacks.get(tokenId)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.updateCallbacks.get(tokenId)?.delete(callback);
    };
  }

  /**
   * Get current snapshot for a token
   */
  getSnapshot(tokenId: string): OrderbookSnapshot | undefined {
    return this.snapshots.get(tokenId);
  }

  /**
   * Get all snapshots
   */
  getAllSnapshots(): Map<string, OrderbookSnapshot> {
    return new Map(this.snapshots);
  }

  /**
   * Update orderbooks for all monitored tokens
   */
  private async updateOrderbooks(): Promise<void> {
    const updatePromises = Array.from(this.monitoring).map((tokenId) =>
      this.updateOrderbook(tokenId)
    );
    await Promise.all(updatePromises);
  }

  /**
   * Update orderbook for a single token
   */
  private async updateOrderbook(tokenId: string): Promise<void> {
    try {
      const orderbook = await this.client.getOrderbook(tokenId, 20);
      if (!orderbook) {
        return;
      }

      const bestBid = this.getBestBid(orderbook);
      const bestAsk = this.getBestAsk(orderbook);
      const midPrice = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : undefined;
      const spread = bestBid && bestAsk ? bestAsk - bestBid : undefined;
      const spreadBps = midPrice && spread ? (spread / midPrice) * 10000 : undefined;

      const snapshot: OrderbookSnapshot = {
        tokenId,
        orderbook,
        timestamp: Date.now(),
        bestBid,
        bestAsk,
        midPrice,
        spread,
        spreadBps,
      };

      this.snapshots.set(tokenId, snapshot);

      // Notify subscribers
      const callbacks = this.updateCallbacks.get(tokenId);
      if (callbacks) {
        callbacks.forEach((callback) => {
          try {
            callback(snapshot);
          } catch (error) {
            logger.error(`Error in orderbook update callback for ${tokenId}`, error);
          }
        });
      }
    } catch (error: any) {
      logger.error(`Failed to update orderbook for token ${tokenId}`, {
        error: error.message,
      });
    }
  }

  /**
   * Get best bid price
   */
  private getBestBid(orderbook: Orderbook): number | undefined {
    if (!orderbook.bids || orderbook.bids.length === 0) {
      return undefined;
    }

    const bids = orderbook.bids.map((bid) => {
      if (typeof bid === 'string') {
        return parseFloat(bid);
      }
      if (Array.isArray(bid)) {
        return parseFloat(bid[0]);
      }
      return parseFloat(bid.price);
    });

    return Math.max(...bids);
  }

  /**
   * Get best ask price
   */
  private getBestAsk(orderbook: Orderbook): number | undefined {
    if (!orderbook.asks || orderbook.asks.length === 0) {
      return undefined;
    }

    const asks = orderbook.asks.map((ask) => {
      if (typeof ask === 'string') {
        return parseFloat(ask);
      }
      if (Array.isArray(ask)) {
        return parseFloat(ask[0]);
      }
      return parseFloat(ask.price);
    });

    return Math.min(...asks);
  }
}

