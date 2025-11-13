# Market Maker Bot/ Liquidity Providing Bot on Polymarket
 
- Market-Maker / Liquidity-Providing Bot
- Goal: Earn many small profits from volume rather than large directional bets.
- Mechanics: monitor the orderbook, place limit orders at selected spreads, adjust for inventory and risk, cancel/adjust if market moves.

---

## 📬 Contact Me

**For questions, support, or inquiries about this bot, feel free to reach out:**

[![Telegram](https://img.shields.io/badge/Telegram-Contact%20Me-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/gigi0500)


## Features

- **Dual-Sided Quotes**: Places limit orders on both YES and NO outcomes
- **Orderbook Monitoring**: Continuously monitors orderbook depth and spread
- **Dynamic Spread Adjustment**: Adjusts quotes based on market conditions and inventory
- **Risk Management**: Tracks inventory and limits exposure to prevent over-exposure
- **Order Management**: Automatically cancels and adjusts orders when market moves
- **REST API**: Control and monitor the bot via HTTP endpoints

## Strategy

The bot implements a market-making strategy that:

1. Monitors orderbook for selected markets
2. Places limit orders at calculated spreads (default: 50 bps)
3. Adjusts quotes based on inventory imbalance
4. Cancels/adjusts orders when market moves significantly
5. Manages risk by limiting total exposure and position sizes

