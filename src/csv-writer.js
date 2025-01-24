import { createObjectCsvWriter } from "csv-writer";
import { join } from "path";
import { config } from "./config.js";

export class CSVWriter {
  constructor() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `orders_export_${timestamp}.csv`;

    this.csvWriter = createObjectCsvWriter({
      path: join(config.exportDir, filename),
      header: [
        { id: "increment_id", title: "ID" },
        { id: "created_at", title: "Processed At" },
        { id: "status", title: "Fulfillment: Status" },
        { id: "customer_email", title: "Customer Email" },
        { id: "customer_firstname", title: "Customer First Name" },
        { id: "customer_lastname", title: "Customer Last Name" },
        { id: "billing_firstname", title: "Billing First Name" },
        { id: "billing_lastname", title: "Billing Last Name" },
        { id: "billing_street", title: "Billing Address 1" },
        { id: "billing_city", title: "Billing City" },
        { id: "billing_region", title: "Billing Province" },
        { id: "billing_postcode", title: "Billing Zip" },
        { id: "billing_country_id", title: "Billing Country" },
        { id: "billing_telephone", title: "Billing Phone" },
        { id: "shipping_firstname", title: "Shipping First Name" },
        { id: "shipping_lastname", title: "Shipping Last Name" },
        { id: "shipping_street", title: "Shipping Address 1" },
        { id: "shipping_city", title: "Shipping City" },
        { id: "shipping_region", title: "Shipping Province" },
        { id: "shipping_postcode", title: "Shipping Zip" },
        { id: "shipping_country_id", title: "Shipping Country" },
        { id: "shipping_telephone", title: "Shipping Phone" },
        { id: "total_item_count", title: "Total Items" },
        { id: "subtotal", title: "Subtotal" },
        { id: "shipping_amount", title: "Shipping Amount" },
        { id: "tax_amount", title: "Tax Amount" },
        { id: "grand_total", title: "Grand Total" },
        { id: "shipping_description", title: "Shipping Method" },
        { id: "payment_method", title: "Payment Method" },
        { id: "payment_status", title: "Payment: Status" },
        { id: "transaction_ids", title: "Transaction IDs" },
        { id: "item_id", title: "Line: ID" },
        { id: "product_id", title: "Line: Product ID" },
        { id: "item_sku", title: "Line: SKU" },
        { id: "item_name", title: "Line: Title" },
        { id: "item_variant_title", title: "Line: Variant Title" },
        { id: "item_qty", title: "Line: Quantity" },
        { id: "item_price", title: "Line: Price" },
        { id: "item_discount", title: "Line: Discount" },
        { id: "item_total", title: "Line: Total" },
        { id: "item_requires_shipping", title: "Line: Requires Shipping" },
        { id: "item_vendor", title: "Line: Vendor" },
        { id: "product_options", title: "Line: Properties" },
        { id: "item_taxable", title: "Line: Taxable" },
        { id: "tax1_title", title: "Tax 1: Title" },
        { id: "tax1_rate", title: "Tax 1: Rate" },
        { id: "tax1_price", title: "Tax 1: Price" },
        { id: "tax2_title", title: "Tax 2: Title" },
        { id: "tax2_rate", title: "Tax 2: Rate" },
        { id: "tax2_price", title: "Tax 2: Price" },
      ],
      headerIdToString: false,
      append: false,
    });
  }

  formatOrderData(order, transactions) {
    const transactionIds = transactions.items
      .map((t) => t.transaction_id)
      .join(";");

    const payment =
      order.payment && order.payment.method ? order.payment.method : "N/A";

    // Helper function to format phone numbers
    const formatPhoneNumber = (phone) => {
      if (!phone) return "";

      // If starts with +, remove it and any following digits until we hit a 0
      if (phone.startsWith("+")) {
        // Remove the + and country code, handling cases with and without spaces
        return phone.replace(/^\+\d+\s*/, "");
      }

      return phone;
    };

    // Map Magento payment status to Shopify format
    const getPaymentStatus = (order) => {
      // Check if order is fully refunded
      if (order.total_refunded && order.total_refunded >= order.grand_total) {
        return "refunded";
      }
      // Check if order is partially refunded
      if (order.total_refunded > 0) {
        return "partially_refunded";
      }

      // Get payment status from order payment
      const paymentState =
        order.payment?.additional_information?.[0] || order.status;

      switch (paymentState?.toLowerCase()) {
        case "pending":
        case "pending_payment":
          return "pending";
        case "processing":
        case "authorized":
        case "authorization":
          return "authorized";
        case "complete":
        case "closed":
        case "paid":
          return "paid";
        case "canceled":
        case "void":
          return "voided";
        default:
          // If payment exists and amount is paid, consider it paid
          if (order.payment && order.payment.amount_paid >= order.grand_total) {
            return "paid";
          }
          // If payment exists but only partial amount is paid
          if (order.payment && order.payment.amount_paid > 0) {
            return "partially_paid";
          }
          // Default to pending if we can't determine status
          return "pending";
      }
    };

    // Format addresses
    const billing = order.billing_address || {};
    const shipping =
      order.extension_attributes?.shipping_assignments?.[0]?.shipping
        ?.address ||
      order.shipping_address ||
      {};

    // In formatOrderData, before the return statement:
    const getTaxDetails = (order) => {
      const taxDetails = {
        tax1_title: "",
        tax1_rate: "",
        tax1_price: "",
        tax2_title: "",
        tax2_rate: "",
        tax2_price: "",
      };

      // Try to get tax information from various Magento locations
      const taxInfo =
        order.extension_attributes?.tax_rates ||
        order.tax_info ||
        order.tax_details;

      if (taxInfo && Array.isArray(taxInfo)) {
        // Handle multiple tax rates
        taxInfo.forEach((tax, index) => {
          if (index < 2) {
            // Only handle first two tax rates
            const num = index + 1;
            taxDetails[`tax${num}_title`] =
              tax.title || tax.code || `Tax ${num}`;
            // Convert percentage to decimal (20% -> 0.20)
            taxDetails[`tax${num}_rate`] = (tax.percent || tax.rate || 0) / 100;
            taxDetails[`tax${num}_price`] = tax.amount || 0;
          }
        });
      } else {
        // Fallback: If we only have basic tax information, use it for Tax 1
        if (order.tax_amount > 0) {
          taxDetails.tax1_title = "Tax";
          // Convert percentage to decimal (20% -> 0.20)
          const firstItem = order.items?.[0];
          taxDetails.tax1_rate = firstItem?.tax_percent
            ? firstItem.tax_percent / 100
            : "";
          taxDetails.tax1_price = order.tax_amount || 0;
        }
      }

      return taxDetails;
    };

    // Add tax details to baseOrderData
    const baseOrderData = {
      increment_id: order.increment_id,
      created_at: order.created_at,
      status: order.status,
      payment_status: getPaymentStatus(order),
      customer_email: order.customer_email,
      customer_firstname: order.customer_firstname || "Guest",
      customer_lastname: order.customer_lastname || "Guest",
      // Billing address with Province
      billing_firstname: billing.firstname || "",
      billing_lastname: billing.lastname || "",
      billing_street: Array.isArray(billing.street)
        ? billing.street.join(", ")
        : billing.street || "",
      billing_city: billing.city || "",
      billing_region: billing.region_code || billing.region || "", // Prefer region_code for province
      billing_postcode: billing.postcode || "",
      billing_country_id: billing.country_id || "",
      billing_telephone: formatPhoneNumber(billing.telephone) || "",
      // Shipping address with Province
      shipping_firstname: shipping.firstname || "",
      shipping_lastname: shipping.lastname || "",
      shipping_street: Array.isArray(shipping.street)
        ? shipping.street.join(", ")
        : shipping.street || "",
      shipping_city: shipping.city || "",
      shipping_region: shipping.region_code || shipping.region || "", // Prefer region_code for province
      shipping_postcode: shipping.postcode || "",
      shipping_country_id: shipping.country_id || "",
      shipping_telephone: formatPhoneNumber(shipping.telephone) || "",
      total_item_count: order.total_item_count,
      subtotal: order.subtotal,
      shipping_amount: order.shipping_amount,
      tax_amount: order.tax_amount,
      grand_total: order.grand_total,
      shipping_description: order.shipping_description,
      payment_method: payment,
      transaction_ids: transactionIds,
      ...getTaxDetails(order),
    };

    // Create a row for each order item
    return order.items.map((item) => {
      // Extract product options
      let productOptions = "";
      if (item.product_options) {
        try {
          const options =
            typeof item.product_options === "string"
              ? JSON.parse(item.product_options)
              : item.product_options;

          if (options.attributes_info) {
            productOptions = options.attributes_info
              .map((attr) => `${attr.label}: ${attr.value}`)
              .join("\n");
          }
        } catch (e) {
          console.warn(
            `Could not parse product options for item ${item.sku} in order ${order.increment_id}`
          );
        }
      }

      return {
        ...baseOrderData,
        item_id: item.item_id || "",
        product_id: item.product_id || "",
        item_sku: item.sku || "",
        item_name: item.name || "",
        item_variant_title: item.variant_title || "",
        item_qty: item.qty_ordered || 0,
        item_price: item.price || 0,
        item_discount: item.discount_amount
          ? -Math.abs(item.discount_amount)
          : 0,
        item_total: item.row_total || 0,
        item_requires_shipping:
          item.product_type !== "virtual" ? "TRUE" : "FALSE",
        item_vendor: item.vendor || "",
        product_options: productOptions,
        item_taxable: item.tax_amount > 0 ? "TRUE" : "FALSE",
      };
    });
  }

  async writeRecords(records) {
    try {
      await this.csvWriter.writeRecords(records);
    } catch (error) {
      console.error("Error writing to CSV:", error);
      throw error;
    }
  }
}
