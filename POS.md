# Loomi point of sale

Point of sale supports food and beverage products, saved open orders, tables/takeaway/bar labels, cash and card sales, room charges, printable/downloadable receipts, full-sale refunds and daily closing. Each property has its own products, orders, currency and business-day closing. Business days use America/Paramaribo.

## Staff

Enable **Use POS and take payments** for cashiers. Enable **Manage POS products, refunds and daily closing** for managers. Accounting access does not grant POS access. Grant a POS permission separately to view orders or collect room charges. Property access restrictions and the self-hosted licence apply to the POS API too.

## Sales and room charges

Add products, choose quantities, then save an open order or checkout. The server sets prices from saved products. Checkout snapshots cannot be edited afterward. Cash and card checkout records full payment; card processing occurs on your external terminal, so confirm it succeeds first.

Charge to room is available only for checked-in reservations. Houses use the whole-house reservation. The sale enters Food or Beverage income immediately; the amount remains owed until collected under Orders & room charges. Accommodation paid stays separate. Reservation balances and Accounting guest balances include unpaid POS charges. Collect POS charges separately before checkout; an unpaid charge remains available in POS even after the guest checks out.

Collecting a room charge creates a cash receipt without recognizing the sale a second time. Accounting prevents editing POS settlements outside POS. Full-sale reversal reduces Food/Beverage income, refunds actual receipts by their original payment methods and cancels unpaid charges. Refund confirmation means you have already returned the money; it does not initiate a terminal refund.

## Closing

Daily totals show gross posted sales, net cash/card receipts, money refunded and room charges. Gross sales include orders subsequently reversed; Profit & Loss shows the credits. Expected drawer cash equals opening cash plus net POS cash receipts. Enter the physical cash count and close today. The saved closing locks sales, collections and refunds for that property until the next business day. Open orders and product editing remain available. Cash movements outside POS are excluded.

## Scope

Products are entered by the hotel; no sample sales or financial records are created. Prices include any tax the hotel builds into them; tax breakdowns are not calculated. This first version does not include integrated card acquiring, fiscal invoicing, receipt-printer drivers, ingredient inventory, kitchen ticket routing, partial/split tender or per-item refunds. Use the browser print dialog for receipts.
