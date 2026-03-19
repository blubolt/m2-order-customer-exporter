import { mkdir } from 'fs/promises';
import { config } from './config.js';
import { MagentoAPI } from './api.js';
import { CSVWriter } from './csv-writer.js';

async function ensureExportDir() {
    try {
        await mkdir(config.exportDir, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') {
            console.error(`❌ Failed to create export directory: ${error.message}`);
            throw error;
        }
    }
}

function parseStartDateArg() {
    const args = process.argv.slice(2);
    const fromIdx = args.indexOf('--from');
    if (fromIdx !== -1 && args[fromIdx + 1]) {
        return args[fromIdx + 1];
    }
    return process.env.START_DATE || null;
}

async function exportOrders() {
    try {
        console.log('🚀 Starting order export...');

        await ensureExportDir();

        const api = new MagentoAPI();
        const csvWriter = new CSVWriter();
        let currentPage = 1;
        let hasMoreOrders = true;
        let totalOrdersProcessed = 0;
        let totalLinesProcessed = 0;

        // Test API connection before starting export
        const connectionTest = await api.testConnection();
        if (!connectionTest) {
            console.error('❌ API connection test failed. Please check your configuration and try again.');
            console.error('💡 Common issues:');
            console.error('   - Invalid MAGENTO_BASE_URL in .env file');
            console.error('   - Invalid MAGENTO_ACCESS_TOKEN in .env file');
            console.error('   - API permissions not granted for orders endpoint');
            console.error('   - Network connectivity issues');
            process.exit(1);
        }

        const createdFrom = parseStartDateArg();
        if (createdFrom) {
            console.log(`🗓️  Filtering orders created on/after: ${createdFrom}`);
        }

        console.log('📦 Starting order processing...\n');

        while (hasMoreOrders) {
            try {
                console.log(`\n📄 Fetching page ${currentPage}...`);
                const ordersResponse = await api.getOrders(currentPage, { createdFrom });

                if (!ordersResponse) {
                    console.log('⚠️  No response received from API');
                    hasMoreOrders = false;
                    continue;
                }

                if (!ordersResponse.items) {
                    console.log('⚠️  Response has no items array');
                    hasMoreOrders = false;
                    continue;
                }

                if (ordersResponse.items.length === 0) {
                    console.log('⚠️  No orders found in this page');
                    hasMoreOrders = false;
                    continue;
                }

                for (const order of ordersResponse.items) {
                    try {
                        console.log(`🔄 Processing order ${order.increment_id || order.entity_id} (${order.status})...`);

                        // Fetch transactions for the order
                        const transactions = await api.getOrderTransactions(order.entity_id);

                        // Optionally fetch shipment data if not available in order extension attributes
                        if (!order.extension_attributes?.shipments &&
                            (order.status === 'complete' || order.status === 'shipped')) {
                            try {
                                const shipmentsResponse = await api.getOrderShipments(order.entity_id);
                                if (shipmentsResponse.items && shipmentsResponse.items.length > 0) {
                                    // Add shipments to order extension attributes
                                    if (!order.extension_attributes) {
                                        order.extension_attributes = {};
                                    }
                                    order.extension_attributes.shipments = shipmentsResponse.items;
                                    console.log(`   📦 Added ${shipmentsResponse.items.length} shipments`);
                                }
                            } catch (shipmentError) {
                                console.warn(`   ⚠️  Could not fetch shipments: ${shipmentError.message}`);
                                // Continue without shipment data
                            }
                        }

                        // Format and immediately write the order data
                        const formattedOrderLines = csvWriter.formatOrderData(order, transactions);
                        await csvWriter.writeRecords(formattedOrderLines);

                        totalOrdersProcessed++;
                        totalLinesProcessed += formattedOrderLines.length;

                        console.log(`   ✅ Processed ${formattedOrderLines.length} line items`);
                    } catch (error) {
                        console.error(`   ❌ Error processing order ${order.increment_id || order.entity_id}:`, error.message);
                        // Continue with next order even if this one fails
                        continue;
                    }
                }

                currentPage++;

                // Check if we've processed all orders
                const totalProcessableOrders = ordersResponse.total_count || 0;
                const estimatedProcessed = (currentPage - 1) * config.pageSize;

                if (totalProcessableOrders <= estimatedProcessed) {
                    console.log('🏁 Reached end of orders');
                    hasMoreOrders = false;
                }

                console.log(`📈 Progress: ${totalOrdersProcessed} orders (${totalLinesProcessed} lines) processed...`);

            } catch (error) {
                console.error(`❌ Error processing page ${currentPage}:`);
                console.error(`   Error Message: ${error.message}`);
                console.error(`   Error Stack:`, error.stack);

                if (error.response?.status === 401) {
                    console.error('🔐 Authentication failed. Please check your access token.');
                    break;
                } else if (error.response?.status === 403) {
                    console.error('🚫 Permission denied. Please check your API permissions.');
                    break;
                } else if (error.response?.status === 404) {
                    console.error('🔍 API endpoint not found. Please check your base URL.');
                    break;
                } else {
                    console.log('🔄 Retrying current page...');
                    // Retry the current page
                    continue;
                }
            }
        }

        console.log(`\n🎉 Export completed successfully!`);
        console.log(`📊 Processed ${totalOrdersProcessed} orders with ${totalLinesProcessed} total line items`);

    } catch (error) {
        console.error('💥 Export failed with critical error:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

exportOrders();
