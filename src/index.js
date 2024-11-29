import { mkdir } from 'fs/promises';
import { config } from './config.js';
import { MagentoAPI } from './api.js';
import { CSVWriter } from './csv-writer.js';

async function ensureExportDir() {
    try {
        await mkdir(config.exportDir, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') {
            throw error;
        }
    }
}

async function exportOrders() {
    try {
        await ensureExportDir();
        
        const api = new MagentoAPI();
        const csvWriter = new CSVWriter();
        let currentPage = 1;
        let hasMoreOrders = true;
        let totalOrdersProcessed = 0;
        let totalLinesProcessed = 0;

        console.log('Starting order export...');

        while (hasMoreOrders) {
            try {
                console.log(`Fetching page ${currentPage}...`);
                const ordersResponse = await api.getOrders(currentPage);
                
                if (!ordersResponse.items || ordersResponse.items.length === 0) {
                    hasMoreOrders = false;
                    continue;
                }

                for (const order of ordersResponse.items) {
                    try {
                        console.log(`Processing order ${order.increment_id}...`);
                        
                        // Fetch transactions for the order
                        const transactions = await api.getOrderTransactions(order.entity_id);
                        
                        // Format and immediately write the order data
                        const formattedOrderLines = csvWriter.formatOrderData(order, transactions);
                        await csvWriter.writeRecords(formattedOrderLines);
                        
                        totalOrdersProcessed++;
                        totalLinesProcessed += formattedOrderLines.length;
                        
                        console.log(`Order ${order.increment_id} processed with ${formattedOrderLines.length} line items`);
                    } catch (error) {
                        console.error(`Error processing order ${order.increment_id}:`, error);
                        // Continue with next order even if this one fails
                        continue;
                    }
                }

                currentPage++;

                // Check if we've processed all orders
                if (ordersResponse.total_count <= currentPage * config.pageSize) {
                    hasMoreOrders = false;
                }

                console.log(`Progress: ${totalOrdersProcessed} orders (${totalLinesProcessed} lines) processed so far...`);

            } catch (error) {
                console.error(`Error processing page ${currentPage}:`, error);
                if (error.response?.status === 401) {
                    console.error('Authentication failed. Please check your access token.');
                    break;
                }
                // Retry the current page
                continue;
            }
        }

        console.log(`Export completed successfully. Processed ${totalOrdersProcessed} orders with ${totalLinesProcessed} total line items.`);

    } catch (error) {
        console.error('Export failed:', error);
        process.exit(1);
    }
}

exportOrders();
