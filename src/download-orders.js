import { mkdir, writeFile, readFile, access } from 'fs/promises';
import { join } from 'path';
import { config } from './config.js';
import { MagentoAPI } from './api.js';

class OrderDownloader {
    constructor() {
        this.cacheDir = join(config.exportDir, 'cache');
        this.statusFile = join(this.cacheDir, 'download-status.json');
        this.api = new MagentoAPI();
    }

    async ensureCacheDir() {
        try {
            await mkdir(this.cacheDir, { recursive: true });
            console.log(`📁 Cache directory ready: ${this.cacheDir}`);
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }

    async loadStatus() {
        try {
            const statusData = await readFile(this.statusFile, 'utf-8');
            return JSON.parse(statusData);
        } catch (error) {
            // Return default status if file doesn't exist
            return {
                totalOrders: 0,
                downloadedOrders: 0,
                lastProcessedPage: 0,
                startTime: new Date().toISOString(),
                completed: false,
                errors: []
            };
        }
    }

    async saveStatus(status) {
        await writeFile(this.statusFile, JSON.stringify(status, null, 2));
    }

    async orderFileExists(orderId) {
        try {
            await access(join(this.cacheDir, `order-${orderId}.json`));
            return true;
        } catch {
            return false;
        }
    }

    async saveOrder(order) {
        const filename = `order-${order.entity_id}.json`;
        const filepath = join(this.cacheDir, filename);

        // Add download metadata
        const orderData = {
            ...order,
            _downloadMetadata: {
                downloadedAt: new Date().toISOString(),
                incrementId: order.increment_id,
                entityId: order.entity_id
            }
        };

        await writeFile(filepath, JSON.stringify(orderData, null, 2));
    }

    async downloadOrders(resume = false) {
        try {
            console.log('🚀 Starting order download process...');

            await this.ensureCacheDir();
            let status = await this.loadStatus();

            if (resume && status.completed) {
                console.log('✅ Download already completed. Use --force to re-download.');
                return;
            }

            if (!resume) {
                status = {
                    totalOrders: 0,
                    downloadedOrders: 0,
                    lastProcessedPage: 0,
                    startTime: new Date().toISOString(),
                    completed: false,
                    errors: []
                };
            }

            // Test API connection
            console.log('🔍 Testing API connection...');
            const connectionTest = await this.api.testConnection();
            if (!connectionTest) {
                console.error('❌ API connection failed');
                process.exit(1);
            }

            let currentPage = status.lastProcessedPage + 1;
            let hasMoreOrders = true;

            console.log(`📦 Starting download from page ${currentPage}...`);

            while (hasMoreOrders) {
                try {
                    console.log(`📄 Downloading page ${currentPage}...`);
                    const ordersResponse = await this.api.getOrders(currentPage);

                    if (!ordersResponse || !ordersResponse.items || ordersResponse.items.length === 0) {
                        console.log('🏁 No more orders to download');
                        hasMoreOrders = false;
                        break;
                    }

                    // Update total orders count on first page
                    if (currentPage === 1) {
                        status.totalOrders = ordersResponse.total_count || 0;
                        console.log(`📊 Total orders to download: ${status.totalOrders}`);
                    }

                    let pageDownloaded = 0;
                    let pageSkipped = 0;

                    for (const order of ordersResponse.items) {
                        try {
                            // Check if order already exists (for resume functionality)
                            if (await this.orderFileExists(order.entity_id)) {
                                pageSkipped++;
                                continue;
                            }

                            // Fetch detailed order data including transactions and shipments
                            console.log(`💾 Downloading order ${order.increment_id}...`);

                            // Get transactions
                            const transactions = await this.api.getOrderTransactions(order.entity_id);
                            order._transactions = transactions;

                            // Get shipments for completed orders
                            if (!order.extension_attributes?.shipments &&
                                (order.status === 'complete' || order.status === 'shipped')) {
                                try {
                                    const shipmentsResponse = await this.api.getOrderShipments(order.entity_id);
                                    if (shipmentsResponse.items && shipmentsResponse.items.length > 0) {
                                        if (!order.extension_attributes) {
                                            order.extension_attributes = {};
                                        }
                                        order.extension_attributes.shipments = shipmentsResponse.items;
                                    }
                                } catch (shipmentError) {
                                    console.warn(`   ⚠️  Could not fetch shipments for order ${order.increment_id}: ${shipmentError.message}`);
                                }
                            }

                            await this.saveOrder(order);
                            pageDownloaded++;
                            status.downloadedOrders++;

                        } catch (error) {
                            console.error(`❌ Error downloading order ${order.increment_id || order.entity_id}:`, error.message);
                            status.errors.push({
                                orderId: order.entity_id,
                                incrementId: order.increment_id,
                                error: error.message,
                                timestamp: new Date().toISOString()
                            });
                        }
                    }

                    status.lastProcessedPage = currentPage;
                    await this.saveStatus(status);

                    console.log(`✅ Page ${currentPage}: Downloaded ${pageDownloaded}, Skipped ${pageSkipped} orders`);
                    console.log(`📈 Progress: ${status.downloadedOrders}/${status.totalOrders} orders (${Math.round(status.downloadedOrders/status.totalOrders*100)}%)`);

                    currentPage++;

                    // Check if we've processed all orders
                    const totalProcessableOrders = ordersResponse.total_count || 0;
                    const estimatedProcessed = (currentPage - 1) * config.pageSize;
                    if (totalProcessableOrders <= estimatedProcessed) {
                        hasMoreOrders = false;
                    }

                } catch (error) {
                    console.error(`❌ Error processing page ${currentPage}:`, error.message);
                    status.errors.push({
                        page: currentPage,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    });

                    if (error.response?.status === 401 || error.response?.status === 403) {
                        console.error('🔐 Authentication/Permission error. Stopping download.');
                        break;
                    }

                    console.log('🔄 Retrying current page...');
                    continue;
                }
            }

            status.completed = true;
            status.completedAt = new Date().toISOString();
            await this.saveStatus(status);

            console.log(`\n🎉 Download completed successfully!`);
            console.log(`📊 Final Statistics:`);
            console.log(`   Total Orders Downloaded: ${status.downloadedOrders}`);
            console.log(`   Errors: ${status.errors.length}`);
            console.log(`   Cache Directory: ${this.cacheDir}`);

            if (status.errors.length > 0) {
                console.log(`\n⚠️  ${status.errors.length} errors occurred during download:`);
                status.errors.slice(0, 5).forEach(error => {
                    console.log(`   - Order ${error.incrementId || error.orderId}: ${error.error}`);
                });
                if (status.errors.length > 5) {
                    console.log(`   ... and ${status.errors.length - 5} more errors`);
                }
            }

        } catch (error) {
            console.error('💥 Download failed with critical error:', error.message);
            process.exit(1);
        }
    }

    async showStatus() {
        try {
            const status = await this.loadStatus();
            console.log('📊 Download Status:');
            console.log(`   Total Orders: ${status.totalOrders}`);
            console.log(`   Downloaded: ${status.downloadedOrders}`);
            console.log(`   Progress: ${status.totalOrders ? Math.round(status.downloadedOrders/status.totalOrders*100) : 0}%`);
            console.log(`   Last Page: ${status.lastProcessedPage}`);
            console.log(`   Completed: ${status.completed ? 'Yes' : 'No'}`);
            console.log(`   Errors: ${status.errors?.length || 0}`);
            console.log(`   Cache Directory: ${this.cacheDir}`);
        } catch (error) {
            console.log('📊 No download status found. Run download first.');
        }
    }
}

// Command line interface
const args = process.argv.slice(2);
const command = args[0];
const flags = args.slice(1);

const downloader = new OrderDownloader();

switch (command) {
    case 'download':
        const resume = flags.includes('--resume');
        downloader.downloadOrders(resume);
        break;

    case 'status':
        downloader.showStatus();
        break;

    default:
        console.log('📖 Usage:');
        console.log('  node src/download-orders.js download [--resume]');
        console.log('  node src/download-orders.js status');
        console.log('');
        console.log('Commands:');
        console.log('  download         Download all orders to cache files');
        console.log('  download --resume Resume interrupted download');
        console.log('  status           Show download progress');
        break;
}