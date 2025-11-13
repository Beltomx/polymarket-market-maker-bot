import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  server: {
    port: number;
    nodeEnv: string;
  };
  polymarket: {
    clobEndpoint: string;
    gammaEndpoint: string;
    dataEndpoint: string;
  };
  wallet: {
    privateKey: string;
    proxyAddress?: string;
    chainId: number;
  };
  strategy: {
    defaultSpreadBps: number;
    defaultOrderSizeUsd: number;
    maxPositionSizeUsd: number;
    maxInventoryImbalance: number;
    orderRefreshIntervalMs: number;
    maxOrdersPerMarket: number;
  };
  risk: {
    maxTotalExposureUsd: number;
    maxPositionPerMarketUsd: number;
    enableRiskLimits: boolean;
  };
  logging: {
    logLevel: string;
  };
}

export const config: Config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  polymarket: {
    clobEndpoint: process.env.POLYMARKET_CLOB_ENDPOINT || 'https://clob.polymarket.com',
    gammaEndpoint: process.env.POLYMARKET_GAMMA_ENDPOINT || 'https://gamma-api.polymarket.com',
    dataEndpoint: process.env.POLYMARKET_DATA_ENDPOINT || 'https://data-api.polymarket.com',
  },
  wallet: {
    privateKey: process.env.PRIVATE_KEY || '',
    proxyAddress: process.env.PROXY_ADDRESS,
    chainId: parseInt(process.env.CHAIN_ID || '137', 10),
  },
  strategy: {
    defaultSpreadBps: parseInt(process.env.DEFAULT_SPREAD_BPS || '50', 10),
    defaultOrderSizeUsd: parseFloat(process.env.DEFAULT_ORDER_SIZE_USD || '10'),
    maxPositionSizeUsd: parseFloat(process.env.MAX_POSITION_SIZE_USD || '100'),
    maxInventoryImbalance: parseFloat(process.env.MAX_INVENTORY_IMBALANCE || '0.6'),
    orderRefreshIntervalMs: parseInt(process.env.ORDER_REFRESH_INTERVAL_MS || '5000', 10),
    maxOrdersPerMarket: parseInt(process.env.MAX_ORDERS_PER_MARKET || '4', 10),
  },
  risk: {
    maxTotalExposureUsd: parseFloat(process.env.MAX_TOTAL_EXPOSURE_USD || '1000'),
    maxPositionPerMarketUsd: parseFloat(process.env.MAX_POSITION_PER_MARKET_USD || '200'),
    enableRiskLimits: process.env.ENABLE_RISK_LIMITS !== 'false',
  },
  logging: {
    logLevel: process.env.LOG_LEVEL || 'info',
  },
};

if (!config.wallet.privateKey) {
  throw new Error('PRIVATE_KEY environment variable is required');
}

