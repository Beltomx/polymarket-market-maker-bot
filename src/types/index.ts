export interface OrderbookLevel {
  price: string;
  size: string;
}

export interface Orderbook {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  timestamp?: string;
  min_order_size?: string;
  tick_size?: string;
}

export interface Market {
  id: string;
  question: string;
  slug: string;
  conditionId: string;
  clobTokenIds: string[];
  active: boolean;
  closed: boolean;
  outcomes?: string[];
}

export interface Position {
  conditionId: string;
  outcome: string;
  size: string;
  avgPrice: string;
  curPrice: string;
  cashPnl: string;
  percentPnl: string;
}

export interface Order {
  id: string;
  marketId: string;
  tokenId: string;
  side: 'BUY' | 'SELL';
  price: string;
  size: string;
  filled: string;
  status: string;
  createdAt: string;
}

export interface MarketMakerConfig {
  spreadBps: number;
  orderSizeUsd: number;
  maxPositionSizeUsd: number;
  maxInventoryImbalance: number;
}

export interface Inventory {
  yesSize: number;
  noSize: number;
  yesValue: number;
  noValue: number;
  netExposure: number;
}

export interface Quote {
  side: 'BUY' | 'SELL';
  price: string;
  size: string;
  tokenId: string;
}

