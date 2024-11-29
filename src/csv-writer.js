import { createObjectCsvWriter } from 'csv-writer';
import { join } from 'path';
import { config } from './config.js';

export class CSVWriter {
    constructor() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `orders_export_${timestamp}.csv`;
        
        this.csvWriter = createObjectCsvWriter({
            path: join(config.exportDir, filename),
            header: [
                { id: 'increment_id', title: 'Order Number' },
                { id: 'created_at', title: 'Order Date' },
                { id: 'status', title: 'Status' },
                { id: 'customer_email', title: 'Customer Email' },
                { id: 'customer_firstname', title: 'Customer First Name' },
                { id: 'customer_lastname', title: 'Customer Last Name' },
                { id: 'total_item_count', title: 'Total Items' },
                { id: 'subtotal', title: 'Subtotal' },
                { id: 'shipping_amount', title: 'Shipping Amount' },
                { id: 'tax_amount', title: 'Tax Amount' },
                { id: 'grand_total', title: 'Grand Total' },
                { id: 'shipping_description', title: 'Shipping Method' },
                { id: 'payment_method', title: 'Payment Method' },
                { id: 'transaction_ids', title: 'Transaction IDs' },
                // Line item specific fields
                { id: 'item_sku', title: 'Item SKU' },
                { id: 'item_parent_sku', title: 'Parent SKU' },
                { id: 'item_name', title: 'Item Name' },
                { id: 'item_qty', title: 'Item Quantity' },
                { id: 'item_price', title: 'Item Price' },
                { id: 'item_row_total', title: 'Item Row Total' },
                { id: 'product_type', title: 'Product Type' },
                { id: 'product_options', title: 'Product Options' }
            ],
            headerIdToString: false,
            append: false 
        });
    }

    formatOrderData(order, transactions) {
        const transactionIds = transactions.items
            .map(t => t.transaction_id)
            .join(';');

        const payment = order.payment && order.payment.method 
            ? order.payment.method 
            : 'N/A';

        // Base order data that will be copied to each line
        const baseOrderData = {
            increment_id: order.increment_id,
            created_at: order.created_at,
            status: order.status,
            customer_email: order.customer_email,
            customer_firstname: order.customer_firstname || 'Guest',
            customer_lastname: order.customer_lastname || 'Guest',
            total_item_count: order.total_item_count,
            subtotal: order.subtotal,
            shipping_amount: order.shipping_amount,
            tax_amount: order.tax_amount,
            grand_total: order.grand_total,
            shipping_description: order.shipping_description,
            payment_method: payment,
            transaction_ids: transactionIds
        };

        // Create a row for each order item
        return order.items.map(item => {
            // Extract product options
            let productOptions = '';
            if (item.product_options) {
                try {
                    const options = typeof item.product_options === 'string' 
                        ? JSON.parse(item.product_options) 
                        : item.product_options;
                    
                    if (options.attributes_info) {
                        productOptions = options.attributes_info
                            .map(attr => `${attr.label}: ${attr.value}`)
                            .join('; ');
                    }
                } catch (e) {
                    console.warn(`Could not parse product options for item ${item.sku} in order ${order.increment_id}`);
                }
            }

            return {
                ...baseOrderData,
                item_sku: item.sku,
                item_parent_sku: item.parent_item_id ? order.items.find(i => i.item_id === item.parent_item_id)?.sku || '' : '',
                item_name: item.name,
                item_qty: item.qty_ordered,
                item_price: item.price,
                item_row_total: item.row_total,
                product_type: item.product_type || '',
                product_options: productOptions
            };
        });
    }

    async writeRecords(records) {
        try {
            await this.csvWriter.writeRecords(records);
        } catch (error) {
            console.error('Error writing to CSV:', error);
            throw error;
        }
    }
}
