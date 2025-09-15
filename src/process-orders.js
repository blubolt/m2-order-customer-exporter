import { mkdir, readFile, readdir, unlink, writeFile, access } from 'fs/promises';
import { join } from 'path';
import { config } from './config.js';
import { CSVWriter } from './csv-writer.js';

class OrderProcessor {
    constructor() {
        this.cacheDir = join(config.exportDir, 'cache');
        this.statusFile = join(this.cacheDir, 'process-status.json');
    }

    async ensureExportDir() {
        try {
            await mkdir(config.exportDir, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                console.error(`❌ Failed to create export directory: ${error.message}`);
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
                totalFiles: 0,
                processedFiles: 0,
                processedOrders: 0,
                totalLines: 0,
                startTime: new Date().toISOString(),
                completed: false,
                errors: [],
                outputFile: null,
                lastProcessedFile: null
            };
        }
    }

    async saveStatus(status) {
        await writeFile(this.statusFile, JSON.stringify(status, null, 2));
    }

    async getCachedOrderFiles() {
        try {
            const files = await readdir(this.cacheDir);
            return files
                .filter(file => file.startsWith('order-') && file.endsWith('.json'))
                .sort(); // Sort for consistent processing order
        } catch (error) {
            console.error('❌ Could not read cache directory:', error.message);
            return [];
        }
    }

    async loadOrder(filename) {
        const filepath = join(this.cacheDir, filename);
        try {
            const orderData = await readFile(filepath, 'utf-8');
            return JSON.parse(orderData);
        } catch (error) {
            console.error(`❌ Error loading order file ${filename}:`, error.message);
            return null;
        }
    }

    async deleteOrderFile(filename) {
        const filepath = join(this.cacheDir, filename);
        try {
            await unlink(filepath);
        } catch (error) {
            console.warn(`⚠️  Could not delete file ${filename}:`, error.message);
        }
    }

    async processOrders(resume = false, outputFilename = null, keepFiles = false) {
        try {
            console.log('🚀 Starting order processing from cache...');

            await this.ensureExportDir();
            let status = await this.loadStatus();

            // Check if cache directory exists
            try {
                await access(this.cacheDir);
            } catch {
                console.error('❌ Cache directory not found. Please download orders first using:');
                console.error('   node src/download-orders.js download');
                process.exit(1);
            }

            if (resume && status.completed) {
                console.log('✅ Processing already completed. Use --force to re-process.');
                return;
            }

            // Get all cached order files
            const orderFiles = await this.getCachedOrderFiles();
            if (orderFiles.length === 0) {
                console.error('❌ No cached order files found. Download orders first.');
                process.exit(1);
            }

            console.log(`📊 Found ${orderFiles.length} cached order files`);

            // Initialize or resume status
            if (!resume) {
                status = {
                    totalFiles: orderFiles.length,
                    processedFiles: 0,
                    processedOrders: 0,
                    totalLines: 0,
                    startTime: new Date().toISOString(),
                    completed: false,
                    errors: [],
                    outputFile: outputFilename,
                    lastProcessedFile: null
                };
            } else {
                console.log(`🔄 Resuming from ${status.processedFiles}/${status.totalFiles} files processed`);
            }

            // Initialize CSV writer
            const append = resume && status.processedFiles > 0;
            const csvWriter = new CSVWriter(status.outputFile, append);

            if (!status.outputFile) {
                status.outputFile = csvWriter.getFilename();
            }

            console.log(`📄 Output file: ${status.outputFile}`);
            console.log(`📦 Starting processing${resume ? ' (resuming)' : ''}...\n`);

            // Process files
            let filesToProcess = orderFiles;
            if (resume && status.lastProcessedFile) {
                const lastIndex = orderFiles.indexOf(status.lastProcessedFile);
                if (lastIndex >= 0) {
                    filesToProcess = orderFiles.slice(lastIndex + 1);
                    console.log(`📍 Resuming from file: ${status.lastProcessedFile}`);
                }
            }

            for (const filename of filesToProcess) {
                try {
                    console.log(`🔄 Processing ${filename}...`);

                    const order = await this.loadOrder(filename);
                    if (!order) {
                        status.errors.push({
                            file: filename,
                            error: 'Could not load order data',
                            timestamp: new Date().toISOString()
                        });
                        continue;
                    }

                    // Format order data (transactions are already included in cached data)
                    const formattedOrderLines = csvWriter.formatOrderData(order);
                    await csvWriter.writeRecords(formattedOrderLines);

                    status.processedFiles++;
                    status.processedOrders++;
                    status.totalLines += formattedOrderLines.length;
                    status.lastProcessedFile = filename;

                    console.log(`   ✅ Processed order ${order.increment_id} (${formattedOrderLines.length} lines)`);

                    // Delete processed file unless keepFiles is true
                    if (!keepFiles) {
                        await this.deleteOrderFile(filename);
                        console.log(`   🗑️  Deleted cache file`);
                    }

                    // Save status periodically
                    if (status.processedFiles % 10 === 0) {
                        await this.saveStatus(status);
                        const progress = (status.processedFiles / status.totalFiles * 100).toFixed(1);
                        console.log(`📈 Progress: ${status.processedFiles}/${status.totalFiles} files (${progress}%) - ${status.totalLines} lines generated`);
                    }

                } catch (error) {
                    console.error(`❌ Error processing ${filename}:`, error.message);
                    status.errors.push({
                        file: filename,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    });
                }
            }

            status.completed = true;
            status.completedAt = new Date().toISOString();
            await this.saveStatus(status);

            console.log(`\n🎉 Processing completed successfully!`);
            console.log(`📊 Final Statistics:`);
            console.log(`   Orders Processed: ${status.processedOrders}`);
            console.log(`   CSV Lines Generated: ${status.totalLines}`);
            console.log(`   Output File: ${status.outputFile}`);
            console.log(`   Cache Files: ${keepFiles ? 'Preserved' : 'Deleted'}`);
            console.log(`   Errors: ${status.errors.length}`);

            if (status.errors.length > 0) {
                console.log(`\n⚠️  ${status.errors.length} errors occurred during processing:`);
                status.errors.slice(0, 5).forEach(error => {
                    console.log(`   - ${error.file}: ${error.error}`);
                });
                if (status.errors.length > 5) {
                    console.log(`   ... and ${status.errors.length - 5} more errors`);
                }
            }

        } catch (error) {
            console.error('💥 Processing failed with critical error:', error.message);
            process.exit(1);
        }
    }

    async showStatus() {
        try {
            const status = await this.loadStatus();
            const orderFiles = await this.getCachedOrderFiles();

            console.log('📊 Processing Status:');
            console.log(`   Total Files: ${status.totalFiles}`);
            console.log(`   Processed: ${status.processedFiles}`);
            console.log(`   Remaining: ${orderFiles.length}`);
            console.log(`   Progress: ${status.totalFiles ? Math.round(status.processedFiles/status.totalFiles*100) : 0}%`);
            console.log(`   Lines Generated: ${status.totalLines}`);
            console.log(`   Output File: ${status.outputFile || 'Not set'}`);
            console.log(`   Completed: ${status.completed ? 'Yes' : 'No'}`);
            console.log(`   Errors: ${status.errors?.length || 0}`);
            console.log(`   Cache Directory: ${this.cacheDir}`);
        } catch (error) {
            console.log('📊 No processing status found.');
        }
    }

    async cleanup() {
        try {
            const orderFiles = await this.getCachedOrderFiles();
            console.log(`🧹 Cleaning up ${orderFiles.length} cache files...`);

            for (const filename of orderFiles) {
                await this.deleteOrderFile(filename);
            }

            // Clean up status files
            try {
                await unlink(this.statusFile);
                await unlink(join(this.cacheDir, 'download-status.json'));
            } catch {
                // Ignore errors for status file cleanup
            }

            console.log('✅ Cache cleanup completed');
        } catch (error) {
            console.error('❌ Cleanup failed:', error.message);
        }
    }
}

// Command line interface
const args = process.argv.slice(2);
const command = args[0];
const flags = args.slice(1);

const processor = new OrderProcessor();

switch (command) {
    case 'process':
        const resume = flags.includes('--resume');
        const keepFiles = flags.includes('--keep-files');
        const outputIndex = flags.indexOf('--output');
        const outputFilename = outputIndex >= 0 && flags[outputIndex + 1] ? flags[outputIndex + 1] : null;

        processor.processOrders(resume, outputFilename, keepFiles);
        break;

    case 'status':
        processor.showStatus();
        break;

    case 'cleanup':
        processor.cleanup();
        break;

    default:
        console.log('📖 Usage:');
        console.log('  node src/process-orders.js process [--resume] [--keep-files] [--output filename.csv]');
        console.log('  node src/process-orders.js status');
        console.log('  node src/process-orders.js cleanup');
        console.log('');
        console.log('Commands:');
        console.log('  process          Process cached order files to CSV');
        console.log('  process --resume Resume interrupted processing');
        console.log('  process --keep-files Keep cache files after processing');
        console.log('  process --output file.csv Specify output filename');
        console.log('  status           Show processing progress');
        console.log('  cleanup          Delete all cache files');
        break;
}