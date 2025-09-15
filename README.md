# Magento 2 Data Exporter

A high-performance Node.js tool for exporting orders and customers from Magento 2 stores. Features a resilient two-phase caching system, resume functionality, rate limiting, and comprehensive CSV exports with fulfillment dates and complete address information.

## Features

### High-Performance Two-Phase Export System
- **Phase 1 (Download)**: Downloads all order data to individual JSON cache files
- **Phase 2 (Process)**: Processes cached files to generate CSV output
- **Resume Capability**: Interrupt and resume at any point in either phase
- **Error Resilience**: Continues processing even if some orders fail
- **Progress Tracking**: Real-time progress monitoring and status checking
- **Automatic Cleanup**: Deletes processed cache files to save disk space

### Enhanced Order Export
- **Complete Order Information**:
  - Order details (number, date, status, fulfillment date)
  - Customer information with complete contact details
  - Line items with SKUs, quantities, prices, and product options
  - Payment method and transaction IDs
  - **Complete Billing Address** (9 fields: name, company, street, city, region, postcode, country, phone)
  - **Complete Shipping Address** (9 fields: name, company, street, city, region, postcode, country, phone)
  - **Fulfillment Dates** extracted from shipment data
  - Product types and configurable options

### Customer Export
- Exports customer data including:
  - Basic customer information
  - Customer group and website details
  - All customer addresses
  - Default billing/shipping status
  - Contact information

### Performance & Reliability Features
- **Caching System**: Store data locally for faster repeated processing
- **Resume Functionality**: Continue interrupted exports from where you left off
- **Rate Limiting**: Prevent server overload with configurable request limits
- **Parallel Processing Ready**: Architecture designed for future parallel enhancements
- **Comprehensive Error Handling**: Detailed error tracking and reporting
- **Disk Space Management**: Automatic cleanup of processed files

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

4. Configure your `.env` file with your Magento 2 store details:
   ```env
   MAGENTO_BASE_URL=https://your-store.com
   MAGENTO_ACCESS_TOKEN=your_access_token
   MAGENTO_CONSUMER_KEY=your_consumer_key
   MAGENTO_CONSUMER_SECRET=your_consumer_secret
   MAGENTO_ACCESS_TOKEN_SECRET=your_access_token_secret
   REQUESTS_PER_SECOND=2
   PAGE_SIZE=50
   ```

## Usage

### Recommended Two-Phase Workflow (High Performance)

For large datasets (1000+ orders), use the two-phase system for better performance and reliability:

```bash
# Phase 1: Download all orders to cache files
npm run download

# Phase 2: Process cached files to CSV
npm run process

# Check status at any time
npm run download:status
npm run process:status
```

### Available Commands

#### Download Phase Commands
```bash
npm run download              # Download all orders to cache files
npm run download:resume       # Resume interrupted download
npm run download:status       # Check download progress
```

#### Process Phase Commands
```bash
npm run process              # Process cache files to CSV (deletes files as processed)
npm run process:resume       # Resume interrupted processing
npm run process:keep         # Process but keep cache files for later use
npm run process:status       # Check processing progress
```

#### Utility Commands
```bash
npm run cleanup             # Delete all cache files and status data
npm start                   # Direct export (original single-phase method)
npm run export-customers    # Export customers (original functionality)
```

### Direct Export (Original Method)

For smaller datasets or one-time exports, you can still use the original direct method:

```bash
npm start
```

This processes orders directly from the API to CSV without caching.

### Customer Export

```bash
npm run export-customers
```

## Workflow Examples

### Large Dataset Export (Recommended)
```bash
# Step 1: Download all order data (resumable)
npm run download

# Step 2: Process to CSV (resumable)
npm run process

# Result: CSV file in exports/ directory
```

### Resume Interrupted Export
```bash
# If download was interrupted
npm run download:resume

# If processing was interrupted
npm run process:resume
```

### Keep Cache Files for Multiple Exports
```bash
# Download once
npm run download

# Process with different options, keeping cache
npm run process:keep

# Process again with custom filename
node src/process-orders.js process --output custom-export.csv --keep-files
```

### Monitor Progress
```bash
# Check download progress
npm run download:status

# Check processing progress
npm run process:status
```

## Configuration

### Environment Variables
- `MAGENTO_BASE_URL`: Your Magento 2 store URL
- `MAGENTO_ACCESS_TOKEN`: Integration access token
- `REQUESTS_PER_SECOND`: API requests per second limit (default: 2)
- `PAGE_SIZE`: Orders per request (default: 50)

### Performance Tuning
- **Rate Limiting**: Adjust `REQUESTS_PER_SECOND` based on your server capacity
- **Batch Size**: Increase `PAGE_SIZE` to 100-200 for faster downloads (max 200)
- **Resume Points**: Status is saved every 10 processed items

## Output Files

### Order Export CSV Structure
Creates `orders_export_[timestamp].csv` with the following columns:

**Order Information:**
- Order Number, Date, Status, Fulfillment Date
- Customer Email, First Name, Last Name
- Totals (Subtotal, Shipping, Tax, Grand Total)
- Payment Method, Transaction IDs

**Billing Address (9 fields):**
- Billing First Name, Last Name, Company
- Billing Street, City, Region, Postcode
- Billing Country, Telephone

**Shipping Address (9 fields):**
- Shipping First Name, Last Name, Company
- Shipping Street, City, Region, Postcode
- Shipping Country, Telephone

**Line Items (one row per item):**
- Item SKU, Name, Quantity, Price
- Product Type, Options
- Parent SKU (for configurable products)

### Customer Export CSV Structure
Creates `customers_export_[timestamp].csv` with customer and address data.

## Cache System

### Cache Directory Structure
```
exports/cache/
├── order-12345.json        # Individual order cache files
├── order-12346.json
├── download-status.json     # Download progress tracking
└── process-status.json      # Processing progress tracking
```

### Cache File Contents
Each order cache file contains:
- Complete order data from Magento API
- Transaction information
- Shipment data (for completed orders)
- Download metadata

## Error Handling & Recovery

### Automatic Recovery
- **Download Phase**: Continues from last successful page
- **Process Phase**: Continues from last processed file
- **Network Issues**: Automatic retry with exponential backoff
- **API Errors**: Detailed logging with error categorization

### Manual Recovery
```bash
# View detailed status
npm run download:status
npm run process:status

# Force clean restart
npm run cleanup
npm run download

# Resume from specific point
npm run download:resume
npm run process:resume
```

## Troubleshooting

### Common Issues

**"No cached order files found"**
```bash
# Solution: Download orders first
npm run download
```

**"Cache directory not found"**
```bash
# Solution: Download orders first
npm run download
```

**"API connection failed"**
- Check `MAGENTO_BASE_URL` in .env file
- Verify `MAGENTO_ACCESS_TOKEN` is valid
- Ensure API permissions are granted

**"Export already completed"**
```bash
# Force re-download
npm run cleanup
npm run download

# Or resume from where you left off
npm run download:resume
```

### Performance Tips
- Use SSD storage for cache files (faster I/O)
- Increase `PAGE_SIZE` to 100-200 for faster downloads
- Monitor memory usage with large datasets
- Use `--keep-files` to avoid re-downloading for multiple exports

## Development

### Project Structure
```
m2-order-customer-exporter/
├── src/
│   ├── index.js              # Direct export (original method)
│   ├── download-orders.js    # Phase 1: Download orders to cache
│   ├── process-orders.js     # Phase 2: Process cache to CSV
│   ├── export-customers.js   # Customer export
│   ├── api.js               # Magento API client
│   ├── csv-writer.js        # Enhanced CSV writer with append support
│   └── config.js            # Configuration management
├── exports/                 # Export output directory
│   └── cache/              # Cache files directory
├── .env                    # Environment configuration
├── .env.example           # Example configuration
└── package.json           # Dependencies and scripts
```

### Adding New Features
1. Update the relevant phase script (`download-orders.js` or `process-orders.js`)
2. Add new API endpoints to `api.js`
3. Update CSV headers in `csv-writer.js`
4. Add new npm scripts to `package.json`
5. Update this README with new functionality

### API Integration
The tool uses Magento 2 REST API endpoints:
- `/rest/V1/orders` - Order data
- `/rest/V1/transactions` - Payment transactions
- `/rest/V1/shipments` - Shipment information
- `/rest/V1/customers/search` - Customer data

## License

MIT License - See LICENSE file for details
