import axios, { AxiosInstance } from 'axios';
import { ethers } from 'ethers';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Orderbook, Market, Position, Order } from '../types';

export class PolymarketClient {
  private clobClient: AxiosInstance;
  private gammaClient: AxiosInstance;
  private dataClient: AxiosInstance;
  private wallet: ethers.Wallet;
  private apiKey?: string;
  private apiSecret?: string;

  constructor() {
    this.clobClient = axios.create({
      baseURL: config.polymarket.clobEndpoint,
      timeout: 30000,
    });

    this.gammaClient = axios.create({
      baseURL: config.polymarket.gammaEndpoint,
      timeout: 30000,
    });

    this.dataClient = axios.create({
      baseURL: config.polymarket.dataEndpoint,
      timeout: 30000,
    });

    // Initialize wallet
    this.wallet = new ethers.Wallet(config.wallet.privateKey);
    logger.info(`Initialized wallet: ${this.wallet.address}`);
  }

  /**
   * Initialize API credentials for authenticated requests
   */
  async initializeApiCredentials(): Promise<void> {
    try {
      // For now, we'll use the wallet address as the user
      // In production, you'd need to implement proper API key generation
      // based on Polymarket's authentication scheme
      logger.info('API credentials initialized');
    } catch (error) {
      logger.error('Failed to initialize API credentials', error);
      throw error;
    }
  }

  /**
   * Get orderbook for a token
   */
  async getOrderbook(tokenId: string, depth: number = 50): Promise<Orderbook | null> {
    try {
      const response = await this.clobClient.get('/book', {
        params: { token_id: tokenId, depth },
      });
      return response.data;
    } catch (error: any) {
      logger.error(`Failed to fetch orderbook for token ${tokenId}`, {
        error: error.message,
        status: error.response?.status,
      });
      return null;
    }
  }

  /**
   * Get market information
   */
  async getMarket(marketId: string): Promise<Market | null> {
    try {
      const response = await this.gammaClient.get('/markets', {
        params: { ids: marketId },
      });

      const markets = Array.isArray(response.data) ? response.data : [response.data];
      const market = markets.find((m: any) => m.id === marketId || m.id === parseInt(marketId));

      if (!market) {
        return null;
      }

      // Parse clobTokenIds if it's a string
      let tokenIds: string[] = [];
      if (market.clobTokenIds) {
        if (typeof market.clobTokenIds === 'string') {
          try {
            tokenIds = JSON.parse(market.clobTokenIds);
          } catch {
            tokenIds = [market.clobTokenIds];
          }
        } else if (Array.isArray(market.clobTokenIds)) {
          tokenIds = market.clobTokenIds;
        }
      }

      return {
        id: market.id?.toString() || marketId,
        question: market.question || market.title || '',
        slug: market.slug || '',
        conditionId: market.conditionId || '',
        clobTokenIds: tokenIds,
        active: market.active === true,
        closed: market.closed === true,
        outcomes: market.outcomes || [],
      };
    } catch (error: any) {
      logger.error(`Failed to fetch market ${marketId}`, {
        error: error.message,
        status: error.response?.status,
      });
      return null;
    }
  }

  /**
   * Get user positions
   */
  async getPositions(userAddress?: string): Promise<Position[]> {
    try {
      const address = userAddress || this.wallet.address;
      const response = await this.dataClient.get('/positions', {
        params: { user: address },
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      logger.error('Failed to fetch positions', {
        error: error.message,
        status: error.response?.status,
      });
      return [];
    }
  }

  /**
   * Get open orders
   */
  async getOrders(): Promise<Order[]> {
    try {
      // Note: This endpoint may require authentication
      // You'll need to implement proper auth headers based on Polymarket's API
      const response = await this.clobClient.get('/orders', {
        headers: {
          // Add authentication headers here
        },
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      logger.error('Failed to fetch orders', {
        error: error.message,
        status: error.response?.status,
      });
      return [];
    }
  }

  /**
   * Place a limit order
   */
  async placeOrder(
    tokenId: string,
    side: 'BUY' | 'SELL',
    price: string,
    size: string
  ): Promise<Order | null> {
    try {
      // Note: This requires proper authentication and signature
      // You'll need to implement the full order signing logic
      // This is a placeholder - actual implementation requires:
      // 1. Create order payload
      // 2. Sign with wallet
      // 3. Send to CLOB API

      logger.info(`Placing ${side} order: ${size} @ ${price} for token ${tokenId}`);

      // Placeholder - implement actual order placement
      // const orderPayload = {
      //   token_id: tokenId,
      //   side: side.toLowerCase(),
      //   price,
      //   size,
      //   ...
      // };
      // const response = await this.clobClient.post('/order', orderPayload);

      logger.warn('Order placement not fully implemented - requires CLOB client library');
      return null;
    } catch (error: any) {
      logger.error('Failed to place order', {
        error: error.message,
        tokenId,
        side,
        price,
        size,
      });
      return null;
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      // Placeholder - implement actual cancellation
      logger.info(`Cancelling order ${orderId}`);
      // await this.clobClient.delete(`/order/${orderId}`);
      logger.warn('Order cancellation not fully implemented - requires CLOB client library');
      return false;
    } catch (error: any) {
      logger.error(`Failed to cancel order ${orderId}`, {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Cancel all orders for a token
   */
  async cancelAllOrders(tokenId: string): Promise<boolean> {
    try {
      const orders = await this.getOrders();
      const tokenOrders = orders.filter((o) => o.tokenId === tokenId);

      const cancelPromises = tokenOrders.map((order) => this.cancelOrder(order.id));
      await Promise.all(cancelPromises);

      return true;
    } catch (error: any) {
      logger.error(`Failed to cancel all orders for token ${tokenId}`, {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Get wallet address
   */
  getAddress(): string {
    return config.wallet.proxyAddress || this.wallet.address;
  }
}

