import { createObjectCsvWriter } from 'csv-writer';
import { join } from 'path';
import { access, constants } from 'fs/promises';
import { config } from './config.js';

export class CSVWriter {
    constructor(filename = null, append = false) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.filename = filename || `orders_export_${timestamp}.csv`;
        this.filepath = join(config.exportDir, this.filename);
        this.append = append;
        this.isFirstWrite = true;

        this.headers = [
            { id: 'increment_id', title: 'Order Number' },
            { id: 'created_at', title: 'Order Date' },
            { id: 'status', title: 'Status' },
            { id: 'fulfillment_date', title: 'Fulfillment Date' },
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
            // Billing Address fields
            { id: 'billing_firstname', title: 'Billing First Name' },
            { id: 'billing_lastname', title: 'Billing Last Name' },
            { id: 'billing_company', title: 'Billing Company' },
            { id: 'billing_street', title: 'Billing Street' },
            { id: 'billing_city', title: 'Billing City' },
            { id: 'billing_region', title: 'Billing Region' },
            { id: 'billing_postcode', title: 'Billing Postcode' },
            { id: 'billing_country_id', title: 'Billing Country' },
            { id: 'billing_telephone', title: 'Billing Telephone' },
            // Shipping Address fields
            { id: 'shipping_firstname', title: 'Shipping First Name' },
            { id: 'shipping_lastname', title: 'Shipping Last Name' },
            { id: 'shipping_company', title: 'Shipping Company' },
            { id: 'shipping_street', title: 'Shipping Street' },
            { id: 'shipping_city', title: 'Shipping City' },
            { id: 'shipping_region', title: 'Shipping Region' },
            { id: 'shipping_postcode', title: 'Shipping Postcode' },
            { id: 'shipping_country_id', title: 'Shipping Country' },
            { id: 'shipping_telephone', title: 'Shipping Telephone' },
            // Line item specific fields
            { id: 'item_sku', title: 'Item SKU' },
            { id: 'item_parent_sku', title: 'Parent SKU' },
            { id: 'item_name', title: 'Item Name' },
            { id: 'item_qty', title: 'Item Quantity' },
            { id: 'item_price', title: 'Item Price' },
            { id: 'item_row_total', title: 'Item Row Total' },
            { id: 'product_type', title: 'Product Type' },
            { id: 'product_options', title: 'Product Options' }
        ];

        this.initializeWriter();
    }

    async initializeWriter() {
        // Check if file exists when appending
        let fileExists = false;
        if (this.append) {
            try {
                await access(this.filepath, constants.F_OK);
                fileExists = true;
                this.isFirstWrite = false;
                console.log(`📄 Appending to existing file: ${this.filename}`);
            } catch {
                console.log(`📄 Creating new file: ${this.filename}`);
            }
        } else {
            console.log(`📄 Creating new file: ${this.filename}`);
        }

        this.csvWriter = createObjectCsvWriter({
            path: this.filepath,
            header: this.headers,
            headerIdToString: false,
            append: this.append && fileExists // Only append if file exists
        });
    }

    async fileExists() {
        try {
            await access(this.filepath, constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }

    getFilepath() {
        return this.filepath;
    }

    getFilename() {
        return this.filename;
    }

    formatOrderData(order, transactions) {
        // Handle transactions from cached data
        const transactionData = transactions || order._transactions;
        const transactionIds = transactionData?.items
            ?.map(t => t.transaction_id)
            .join(';') || '';

        const payment = order.payment && order.payment.method
            ? order.payment.method
            : 'N/A';

        // Extract fulfillment date from shipments
        const fulfillmentDate = this.extractFulfillmentDate(order);

        // Extract billing address information
        const billingAddress = this.extractBillingAddress(order);

        // Extract shipping address information
        const shippingAddress = this.extractShippingAddress(order);

        // Base order data that will be copied to each line
        const baseOrderData = {
            increment_id: order.increment_id,
            created_at: order.created_at,
            status: order.status,
            fulfillment_date: fulfillmentDate,
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
            transaction_ids: transactionIds,
            // Billing address fields
            billing_firstname: billingAddress.firstname,
            billing_lastname: billingAddress.lastname,
            billing_company: billingAddress.company,
            billing_street: billingAddress.street,
            billing_city: billingAddress.city,
            billing_region: billingAddress.region,
            billing_postcode: billingAddress.postcode,
            billing_country_id: billingAddress.country_id,
            billing_telephone: billingAddress.telephone,
            // Shipping address fields
            shipping_firstname: shippingAddress.firstname,
            shipping_lastname: shippingAddress.lastname,
            shipping_company: shippingAddress.company,
            shipping_street: shippingAddress.street,
            shipping_city: shippingAddress.city,
            shipping_region: shippingAddress.region,
            shipping_postcode: shippingAddress.postcode,
            shipping_country_id: shippingAddress.country_id,
            shipping_telephone: shippingAddress.telephone
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

    extractFulfillmentDate(order) {
        // Try to get fulfillment date from various possible sources

        // Check if order has shipments and get the earliest shipment date
        if (order.extension_attributes && order.extension_attributes.shipments && order.extension_attributes.shipments.length > 0) {
            const shipmentDates = order.extension_attributes.shipments
                .filter(s => s.created_at)
                .map(s => new Date(s.created_at))
                .sort((a, b) => a - b);

            if (shipmentDates.length > 0) {
                return shipmentDates[0].toISOString().split('T')[0]; // Return date part only
            }
        }

        // Check if order status history contains shipment information
        if (order.status_histories && order.status_histories.length > 0) {
            const shipmentHistory = order.status_histories.find(h =>
                h.status === 'complete' ||
                h.status === 'shipped' ||
                (h.comment && h.comment.toLowerCase().includes('shipped'))
            );

            if (shipmentHistory) {
                return new Date(shipmentHistory.created_at).toISOString().split('T')[0];
            }
        }

        // Check if order status indicates completion
        if (order.status === 'complete' && order.updated_at) {
            return new Date(order.updated_at).toISOString().split('T')[0];
        }

        // Return empty string if no fulfillment date found
        return '';
    }

    extractBillingAddress(order) {
        const defaultAddress = {
            firstname: '',
            lastname: '',
            company: '',
            street: '',
            city: '',
            region: '',
            postcode: '',
            country_id: '',
            telephone: ''
        };

        if (!order.billing_address) {
            return defaultAddress;
        }

        const billing = order.billing_address;
        return {
            firstname: billing.firstname || '',
            lastname: billing.lastname || '',
            company: billing.company || '',
            street: Array.isArray(billing.street) ? billing.street.join(', ') : (billing.street || ''),
            city: billing.city || '',
            region: billing.region || (billing.region_code || ''),
            postcode: billing.postcode || '',
            country_id: billing.country_id || '',
            telephone: billing.telephone || ''
        };
    }

    extractShippingAddress(order) {
        const defaultAddress = {
            firstname: '',
            lastname: '',
            company: '',
            street: '',
            city: '',
            region: '',
            postcode: '',
            country_id: '',
            telephone: ''
        };

        // For virtual/downloadable products, there might not be a shipping address
        if (!order.extension_attributes || !order.extension_attributes.shipping_assignments ||
            !order.extension_attributes.shipping_assignments[0] ||
            !order.extension_attributes.shipping_assignments[0].shipping ||
            !order.extension_attributes.shipping_assignments[0].shipping.address) {
            return defaultAddress;
        }

        const shipping = order.extension_attributes.shipping_assignments[0].shipping.address;
        return {
            firstname: shipping.firstname || '',
            lastname: shipping.lastname || '',
            company: shipping.company || '',
            street: Array.isArray(shipping.street) ? shipping.street.join(', ') : (shipping.street || ''),
            city: shipping.city || '',
            region: shipping.region || (shipping.region_code || ''),
            postcode: shipping.postcode || '',
            country_id: shipping.country_id || '',
            telephone: shipping.telephone || ''
        };
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
