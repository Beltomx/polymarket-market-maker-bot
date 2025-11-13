# Implementation Notes

## CLOB Client Integration

The `PolymarketClient` class currently has placeholder implementations for order placement and cancellation. To fully implement these features, you need to integrate with Polymarket's CLOB API using proper authentication and order signing.

### Required Steps:

1. **Install/Integrate CLOB Client Library**
   - Option 1: Use the official `@polymarket/clob-client` npm package if available
   - Option 2: Port the Python `py-clob-client` functionality to TypeScript
   - Option 3: Implement the CLOB API calls directly with proper signing

2. **Order Signing**
   - Orders must be signed with your Ethereum private key
   - The signature type depends on whether you're using a proxy wallet (type 2) or direct EOA (type 0)
   - See Polymarket's documentation for the exact signing format

3. **API Authentication**
   - Some endpoints require API credentials
   - You may need to generate API keys through Polymarket's interface
   - Store credentials securely in environment variables

### Example Order Placement (Pseudocode)

```typescript
async placeOrder(tokenId: string, side: 'BUY' | 'SELL', price: string, size: string): Promise<Order | null> {
  // 1. Create order payload
  const orderPayload = {
    token_id: tokenId,
    side: side.toLowerCase(),
    price,
    size,
    // ... other required fields
  };

  // 2. Sign the order
  const signature = await this.signOrder(orderPayload);

  // 3. Send to CLOB API
  const response = await this.clobClient.post('/order', {
    ...orderPayload,
    signature,
    // ... auth headers
  });

  return response.data;
}
```

## Testing

Before running in production:

1. **Test on Testnet/Staging**
   - Use small order sizes
   - Monitor positions closely
   - Verify order placement and cancellation

2. **Risk Limits**
   - Start with conservative limits
   - Gradually increase as you gain confidence
   - Monitor inventory imbalance closely

3. **Market Selection**
   - Start with liquid markets
   - Avoid markets close to resolution
   - Monitor for sudden market moves

## Configuration

Key configuration parameters:

- `DEFAULT_SPREAD_BPS`: Spread in basis points (50 = 0.5%)
- `DEFAULT_ORDER_SIZE_USD`: Size of each order in USD
- `MAX_POSITION_SIZE_USD`: Maximum position size per market
- `MAX_INVENTORY_IMBALANCE`: Maximum allowed inventory imbalance (0.6 = 60%)
- `ORDER_REFRESH_INTERVAL_MS`: How often to update quotes

## Risk Management

The bot includes several risk management features:

1. **Inventory Limits**: Prevents over-exposure to one side
2. **Position Limits**: Maximum position size per market
3. **Total Exposure**: Maximum total exposure across all markets
4. **Dynamic Spread Adjustment**: Widens spread when inventory is imbalanced

## Monitoring

Monitor these metrics:

- Total exposure across all positions
- Inventory imbalance per market
- Order fill rates
- P&L per market
- Spread capture

## API Endpoints

- `POST /api/markets/:marketId/start` - Start market making
- `POST /api/markets/:marketId/stop` - Stop market making
- `GET /api/status` - Bot status and statistics
- `GET /api/positions` - Current positions
- `GET /api/orders` - Open orders
- `GET /api/inventory/:conditionId` - Inventory for a market

