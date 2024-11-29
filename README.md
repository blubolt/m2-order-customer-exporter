# Magento 2 Data Exporter

A Node.js tool for exporting orders and customers from Magento 2 stores. Features rate limiting to prevent server overload and detailed CSV exports with comprehensive information.

## Features

### Order Export
- Exports complete order information including:
  - Order details (number, date, status)
  - Customer information
  - Line items with SKUs and product options
  - Payment and shipping information
  - Transaction IDs
  - Product types and configurable options

### Customer Export
- Exports customer data including:
  - Basic customer information
  - Customer group and website details
  - All customer addresses
  - Default billing/shipping status
  - Contact information

### General Features
- Rate limiting to prevent server overload
- Progress tracking and logging
- Error handling with continued processing
- Timestamped CSV files
- Configurable batch sizes

## Setup

1. Clone this repository:
   ```bash
   git clone [repository-url]
   cd m2-order-exporter
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

4. Configure your `.env` file with your Magento 2 store details:
   ```
   MAGENTO_BASE_URL=https://your-store.com
   MAGENTO_ACCESS_TOKEN=your_access_token
   MAGENTO_CONSUMER_KEY=your_consumer_key
   MAGENTO_CONSUMER_SECRET=your_consumer_secret
   MAGENTO_ACCESS_TOKEN_SECRET=your_access_token_secret
   REQUESTS_PER_SECOND=2
   PAGE_SIZE=50
   ```

## Usage

### Export Orders
Run the order export:
```bash
npm start
```

The order export will create a CSV file in the `exports` directory with the following information:
- Order details (number, date, status)
- Customer information
- Line items (one row per item)
- Payment and shipping details
- Transaction information
- Product details including SKUs and options

### Export Customers
Run the customer export:
```bash
npm run export-customers
```

The customer export will create a CSV file in the `exports` directory with the following information:
- Customer basic details
- Customer group information
- All addresses (one row per address)
- Default billing/shipping indicators
- Contact information

## Configuration

### Environment Variables
- `MAGENTO_BASE_URL`: Your Magento 2 store URL
- `MAGENTO_ACCESS_TOKEN`: Integration access token
- `MAGENTO_CONSUMER_KEY`: Integration consumer key
- `MAGENTO_CONSUMER_SECRET`: Integration consumer secret
- `MAGENTO_ACCESS_TOKEN_SECRET`: Integration access token secret
- `REQUESTS_PER_SECOND`: Number of API requests per second (default: 2)
- `PAGE_SIZE`: Number of items to fetch per request (default: 50)

### Rate Limiting
The tool implements rate limiting to prevent overwhelming your Magento server:
- Configurable requests per second via `REQUESTS_PER_SECOND`
- Default is 2 requests per second
- Adjust based on your server's capacity

### Batch Size
- Configurable via `PAGE_SIZE`
- Default is 50 items per request
- Adjust based on your data size and server capacity

## Output Files

### Orders Export
Creates a file named `orders_export_[timestamp].csv` containing:
- One row per order line item
- All order information repeated for each line
- Detailed product information
- Transaction and payment details

### Customers Export
Creates a file named `customers_export_[timestamp].csv` containing:
- One row per customer address
- All customer information repeated for each address
- Detailed address information
- Default address indicators

## Error Handling
- Continues processing if individual items fail
- Logs errors for review
- Maintains progress even if some items fail
- Creates export file even with partial data

## Development

### Project Structure
```
m2-order-exporter/
├── src/
│   ├── index.js           # Order export main script
│   ├── export-customers.js # Customer export script
│   ├── api.js             # Magento API client
│   ├── csv-writer.js      # CSV writing functionality
│   └── config.js          # Configuration management
├── exports/               # Export output directory
├── .env                   # Environment configuration
├── .env.example          # Example environment configuration
└── package.json          # Project dependencies
```

### Adding New Features
1. Update the relevant script in `src/`
2. Add any new API endpoints to `api.js`
3. Update CSV headers in the relevant writer
4. Update documentation in README.md

## License

MIT License - See LICENSE file for details
