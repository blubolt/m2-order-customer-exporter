# Magento 2 Data Exporter

A Node.js tool for exporting orders and customers from Magento 2 stores to CSV. Features rate limiting to prevent server overload and supports optional date range filtering.

## Prerequisites

- Node.js (v18+)
- Access to the Magento 2 store's REST API
- A Magento integration access token with read permissions for orders and customers

## Setup

1. Clone this repository:
   ```bash
   git clone [repository-url]
   cd m2-order-customer-exporter
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

4. Fill in your `.env` file:
   ```
   MAGENTO_BASE_URL=https://your-store.com
   MAGENTO_ACCESS_TOKEN=your_access_token
   REQUESTS_PER_SECOND=2
   PAGE_SIZE=50
   ```

   - `MAGENTO_BASE_URL` — your Magento store's base URL (no trailing slash)
   - `MAGENTO_ACCESS_TOKEN` — integration access token from Magento Admin > System > Integrations
   - `REQUESTS_PER_SECOND` — API rate limit (default: 2, increase carefully)
   - `PAGE_SIZE` — records per API page (default: 50)

## Usage

Exported CSV files are saved to the `exports/` directory with a timestamp in the filename.

### Export Orders

Export all orders:
```bash
npm start
```

Export orders from a specific date onwards:
```bash
node src/index.js 2026-01-01
```

Export orders within a date range:
```bash
node src/index.js 2026-01-01 2026-03-13
```

You can also set dates via environment variables:
```bash
FROM_DATE=2026-01-01 TO_DATE=2026-03-13 npm start
```

Output file: `exports/orders_export_[timestamp].csv`

Each order produces one row per line item plus one row for the shipping line. All order-level fields (customer, billing/shipping address, totals, payment) are repeated on each row.

**Columns include:** Order ID, date, status, customer details, billing & shipping address, totals (subtotal, shipping, tax, grand total), payment method & status, transaction IDs, line item details (SKU, name, qty, price, discount), and up to 2 tax bands.

### Export Customers

Export all customers:
```bash
npm run export-customers
```

Export customers created from a specific date onwards:
```bash
node src/export-customers.js 2026-01-01
```

Export customers created within a date range:
```bash
node src/export-customers.js 2026-01-01 2026-03-13
```

Output file: `exports/customers_export_[timestamp].csv`

Each customer produces one row per saved address. All customer-level fields are repeated on each row.

**Columns include:** Customer ID, email, name, created date, group/store/website IDs, date of birth, gender, address details (billing/shipping type, street, city, region, postcode, country, phone), and order summary stats (total orders, total spent, average order value).

## Output Files

| Script | Output filename |
|--------|----------------|
| Orders | `exports/orders_export_[timestamp].csv` |
| Customers | `exports/customers_export_[timestamp].csv` |

## Error Handling

- Individual failed orders/customers are logged and skipped — the export continues
- A 401 authentication error will stop the export immediately
- Partial exports are written to file as they are processed

## Project Structure

```
m2-order-customer-exporter/
├── src/
│   ├── index.js             # Order export entry point
│   ├── export-customers.js  # Customer export entry point
│   ├── api.js               # Magento REST API client
│   ├── csv-writer.js        # Order CSV formatting and writing
│   └── config.js            # Configuration (reads from .env)
├── exports/                 # CSV output directory (auto-created)
├── .env                     # Your local environment config (not committed)
├── .env.example             # Template for .env
└── package.json
```
