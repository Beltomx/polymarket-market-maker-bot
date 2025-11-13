import { PolymarketClient } from '../clients/polymarketClient';
import { logger } from '../utils/logger';
import { Position, Inventory } from '../types';

export class InventoryManager {
  private client: PolymarketClient;
  private positions: Map<string, Position> = new Map();
  private updateInterval?: NodeJS.Timeout;

  constructor(client: PolymarketClient) {
    this.client = client;
  }

  /**
   * Start periodic inventory updates
   */
  start(intervalMs: number = 10000): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(() => {
      this.updateInventory();
    }, intervalMs);

    this.updateInventory(); // Initial update
    logger.info('Started inventory manager');
  }

  /**
   * Stop inventory updates
   */
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
    logger.info('Stopped inventory manager');
  }

  /**
   * Update inventory from API
   */
  async updateInventory(): Promise<void> {
    try {
      const positions = await this.client.getPositions();
      this.positions.clear();

      positions.forEach((position) => {
        const key = `${position.conditionId}-${position.outcome}`;
        this.positions.set(key, position);
      });

      logger.debug(`Updated inventory: ${positions.length} positions`);
    } catch (error: any) {
      logger.error('Failed to update inventory', {
        error: error.message,
      });
    }
  }

  /**
   * Get inventory for a market (condition ID)
   */
  getInventory(conditionId: string): Inventory {
    const yesKey = `${conditionId}-YES`;
    const noKey = `${conditionId}-NO`;

    const yesPosition = this.positions.get(yesKey);
    const noPosition = this.positions.get(noKey);

    const yesSize = yesPosition ? parseFloat(yesPosition.size) : 0;
    const noSize = noPosition ? parseFloat(noPosition.size) : 0;
    const yesValue = yesPosition ? parseFloat(yesPosition.curPrice || '0') * yesSize : 0;
    const noValue = noPosition ? parseFloat(noPosition.curPrice || '0') * noSize : 0;

    const totalValue = yesValue + noValue;
    const netExposure = yesValue - noValue;

    return {
      yesSize,
      noSize,
      yesValue,
      noValue,
      netExposure,
    };
  }

  /**
   * Calculate inventory imbalance ratio
   * Returns value between -1 and 1, where:
   * -1 = fully YES, 1 = fully NO, 0 = balanced
   */
  getInventoryImbalance(conditionId: string): number {
    const inventory = this.getInventory(conditionId);
    const totalValue = inventory.yesValue + inventory.noValue;

    if (totalValue === 0) {
      return 0;
    }

    return inventory.netExposure / totalValue;
  }

  /**
   * Check if inventory is within acceptable limits
   */
  isInventoryBalanced(conditionId: string, maxImbalance: number): boolean {
    const imbalance = Math.abs(this.getInventoryImbalance(conditionId));
    return imbalance <= maxImbalance;
  }

  /**
   * Get all positions
   */
  getAllPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  /**
   * Get position for a specific condition and outcome
   */
  getPosition(conditionId: string, outcome: string): Position | undefined {
    const key = `${conditionId}-${outcome}`;
    return this.positions.get(key);
  }
}

