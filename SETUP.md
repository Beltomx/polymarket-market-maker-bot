# Setup Guide

## Prerequisites

- Node.js 18+ and npm
- TypeScript knowledge
- Polymarket account with funded wallet
- Private key for your Ethereum wallet

## Installation

1. **Install dependencies**
   ```bash
   cd polymarket-market-maker-bot
   npm install
   ```

2. **Create environment file**
   Create a `.env` file in the root directory with the following variables:
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # Polymarket Configuration
   POLYMARKET_CLOB_ENDPOINT=https://clob.polymarket.com
   POLYMARKET_GAMMA_ENDPOINT=https://gamma-api.polymarket.com
   POLYMARKET_DATA_ENDPOINT=https://data-api.polymarket.com

   # Wallet Configuration
   PRIVATE_KEY=your_private_key_here
   PROXY_ADDRESS=your_proxy_address_here
   CHAIN_ID=137

   # Market Maker Strategy Configuration
   DEFAULT_SPREAD_BPS=50
   DEFAULT_ORDER_SIZE_USD=10
   MAX_POSITION_SIZE_USD=100
   MAX_INVENTORY_IMBALANCE=0.6
   ORDER_REFRESH_INTERVAL_MS=5000
   MAX_ORDERS_PER_MARKET=4

   # Risk Management
   MAX_TOTAL_EXPOSURE_USD=1000
   MAX_POSITION_PER_MARKET_USD=200
   ENABLE_RISK_LIMITS=true

   # Logging
   LOG_LEVEL=info
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

## Running

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

## Usage Examples

### Start Market Making for a Market

```bash
curl -X POST http://localhost:3000/api/markets/538932/start \
  -H "Content-Type: application/json" \
  -d '{
    "spreadBps": 50,
    "orderSizeUsd": 10,
    "maxPositionSizeUsd": 100
  }'
```

### Stop Market Making

```bash
curl -X POST http://localhost:3000/api/markets/538932/stop
```

### Check Status

```bash
curl http://localhost:3000/api/status
```

### Get Positions

```bash
curl http://localhost:3000/api/positions
```

### Get Open Orders

```bash
curl http://localhost:3000/api/orders
```

## Important Notes

⚠️ **Before Production Use:**

1. **Complete CLOB Integration**: The order placement functionality needs to be fully implemented with proper signing. See `IMPLEMENTATION_NOTES.md`.

2. **Test Thoroughly**: Test with small amounts first on testnet/staging if available.

3. **Monitor Closely**: Keep an eye on positions, inventory, and P&L.

4. **Risk Management**: Adjust risk limits based on your capital and risk tolerance.

5. **Market Selection**: Choose liquid markets and avoid markets close to resolution.

## Troubleshooting

### "PRIVATE_KEY environment variable is required"
- Make sure your `.env` file exists and contains `PRIVATE_KEY`

### Order placement not working
- See `IMPLEMENTATION_NOTES.md` for CLOB client integration steps
- Verify your wallet has sufficient balance
- Check API authentication credentials

### Orders not filling
- Check if spread is too wide
- Verify market liquidity
- Monitor orderbook depth

