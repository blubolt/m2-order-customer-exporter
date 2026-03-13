import { mkdir } from "fs/promises";
import dotenv from "dotenv";
import { config } from "./config.js";
import { MagentoAPI } from "./api.js";
import { createObjectCsvWriter } from "csv-writer";
import { join } from "path";

// Configure dotenv
dotenv.config();

class CustomerCSVWriter {
  constructor() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `customers_export_${timestamp}.csv`;

    this.csvWriter = createObjectCsvWriter({
      path: join(config.exportDir, filename),
      header: [
        // Customer fields
        { id: "customer_id", title: "ID" },
        { id: "email", title: "Email" },
        { id: "firstname", title: "First Name" },
        { id: "lastname", title: "Last Name" },
        { id: "created_at", title: "Created Date" },
        { id: "group_id", title: "Customer Group ID" },
        { id: "store_id", title: "Store ID" },
        { id: "website_id", title: "Website ID" },
        { id: "dob", title: "Date of Birth" },
        { id: "gender", title: "Gender" },
        // Address fields
        { id: "address_id", title: "Address ID" },
        { id: "address_type", title: "Address Type" },
        { id: "city", title: "Address City" },
        { id: "company", title: "Address Company" },
        { id: "country_id", title: "Address Country" },
        { id: "fax", title: "Address Fax" },
        { id: "telephone", title: "Address Phone" },
        { id: "postcode", title: "Address Zip" },
        { id: "prefix", title: "Address Prefix" },
        { id: "region", title: "Address Province" },
        { id: "region_code", title: "Address Province Code" },
        { id: "street", title: "Address Line 1" },
        { id: "is_default_billing", title: "Address Is Default" },
        // New Order Summary Fields
        { id: "total_orders", title: "Total Orders" },
        { id: "total_spent", title: "Total Spent" },
        { id: "average_order_value", title: "Average Order Value" },
      ],
      headerIdToString: false,
      append: false,
    });
  }

  async formatCustomerData(customer, api) {
    // Fetch additional customer data
    const orderStats = await this.getCustomerOrderStats(customer.id, api);

    const baseCustomerData = {
      customer_id: customer.id,
      email: customer.email,
      firstname: customer.firstname,
      lastname: customer.lastname,
      created_at: customer.created_at,
      group_id: customer.group_id,
      store_id: customer.store_id,
      website_id: customer.website_id,
      dob: customer.dob || "",
      gender: customer.gender || "",
      // Add order summary data
      total_orders: orderStats.total_orders || 0,
      total_spent: orderStats.total_spent || 0,
      average_order_value: orderStats.average_order_value || 0,
      last_order_date: orderStats.last_order_date || "",
      first_order_date: orderStats.first_order_date || "",
    };

    // If customer has no addresses, return one row with just customer data
    if (!customer.addresses || customer.addresses.length === 0) {
      return [
        {
          ...baseCustomerData,
          address_id: "",
          address_type: "",
          city: "",
          company: "",
          country_id: "",
          fax: "",
          telephone: "",
          postcode: "",
          prefix: "",
          region: "",
          region_code: "",
          street: "",
          is_default_billing: "",
          is_default_shipping: "",
        },
      ];
    }

    // Create a row for each address
    return customer.addresses.map((address) => ({
      ...baseCustomerData,
      address_id: address.id,
      address_type: this.getAddressType(address, customer),
      city: address.city,
      company: address.company || "",
      country_id: address.country_id,
      fax: address.fax || "",
      telephone: address.telephone || "",
      postcode: address.postcode,
      prefix: address.prefix || "",
      region: address.region?.region || "",
      region_code: address.region?.region_code || "",
      street: Array.isArray(address.street)
        ? address.street.join(", ")
        : address.street,
      is_default_billing: address.default_billing ? "Yes" : "No",
      is_default_shipping: address.default_shipping ? "Yes" : "No",
    }));
  }

  getAddressType(address, customer) {
    const types = [];
    if (address.id === customer.default_billing) types.push("Billing");
    if (address.id === customer.default_shipping) types.push("Shipping");
    return types.length ? types.join("/") : "Other";
  }

  async writeRecords(records) {
    try {
      await this.csvWriter.writeRecords(records);
    } catch (error) {
      console.error("Error writing to CSV:", error);
      throw error;
    }
  }

  async getCustomerOrderStats(customerId, api) {
    try {
      const orders = await api.getCustomerOrders(customerId);

      if (!orders || orders.length === 0) {
        return {
          total_orders: 0,
          total_spent: 0,
          average_order_value: 0,
          last_order_date: "",
          first_order_date: "",
        };
      }

      const total_orders = orders.length;
      const total_spent = orders.reduce(
        (sum, order) => sum + (parseFloat(order.grand_total) || 0),
        0
      );
      const average_order_value =
        total_orders > 0 ? total_spent / total_orders : 0;
      const orderDates = orders.map((order) => new Date(order.created_at));
      const last_order_date = new Date(Math.max(...orderDates)).toISOString();
      const first_order_date = new Date(Math.min(...orderDates)).toISOString();

      return {
        total_orders,
        total_spent: total_spent.toFixed(2),
        average_order_value: average_order_value.toFixed(2),
        last_order_date,
        first_order_date,
      };
    } catch (error) {
      console.error(
        `Error fetching order stats for customer ${customerId}:`,
        error
      );
      return {
        total_orders: 0,
        total_spent: 0,
        average_order_value: 0,
        last_order_date: "",
        first_order_date: "",
      };
    }
  }
}

async function ensureExportDir() {
  try {
    await mkdir(config.exportDir, { recursive: true });
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }
}

async function exportCustomers(fromDate = null, toDate = null) {
  try {
    await ensureExportDir();

    const api = new MagentoAPI();
    const csvWriter = new CustomerCSVWriter();
    let currentPage = 1;
    let hasMoreCustomers = true;
    let totalCustomersProcessed = 0;
    let totalAddressesProcessed = 0;

    console.log("Starting customer export...");
    if (fromDate) {
      console.log(
        `Exporting customers from ${fromDate}${
          toDate ? ` to ${toDate}` : ""
        }...`
      );
    }

    while (hasMoreCustomers) {
      try {
        console.log(`Fetching customer page ${currentPage}...`);
        const customersResponse = await api.getCustomers(
          currentPage,
          fromDate,
          toDate
        );

        if (!customersResponse.items || customersResponse.items.length === 0) {
          hasMoreCustomers = false;
          continue;
        }

        for (const customer of customersResponse.items) {
          try {
            console.log(`Processing customer ${customer.email}...`);

            // Format and immediately write the customer data
            const formattedCustomerData = await csvWriter.formatCustomerData(
              customer,
              api
            );
            await csvWriter.writeRecords(formattedCustomerData);

            totalCustomersProcessed++;
            totalAddressesProcessed += customer.addresses?.length || 0;

            console.log(
              `Customer ${customer.email} processed with ${
                customer.addresses?.length || 0
              } addresses`
            );
          } catch (error) {
            console.error(
              `Error processing customer ${customer.email}:`,
              error
            );
            // Continue with next customer even if this one fails
            continue;
          }
        }

        currentPage++;

        // Check if we've processed all customers
        if (customersResponse.total_count <= currentPage * config.pageSize) {
          hasMoreCustomers = false;
        }

        console.log(
          `Progress: ${totalCustomersProcessed} customers (${totalAddressesProcessed} addresses) processed so far...`
        );
      } catch (error) {
        console.error(`Error processing page ${currentPage}:`, error);
        if (error.response?.status === 401) {
          console.error(
            "Authentication failed. Please check your access token."
          );
          break;
        }
        // Retry the current page
        continue;
      }
    }

    console.log(
      `Export completed successfully. Processed ${totalCustomersProcessed} customers with ${totalAddressesProcessed} total addresses.`
    );
  } catch (error) {
    console.error("Export failed:", error);
    process.exit(1);
  }
}

// Update the script execution
const fromDate = process.argv[2] || process.env.FROM_DATE || null;
const toDate = process.argv[3] || process.env.TO_DATE || null;

console.log("Debug - Environment variables:");
console.log("FROM_DATE:", process.env.FROM_DATE);
console.log("TO_DATE:", process.env.TO_DATE);
console.log("Using dates:", { fromDate, toDate });

exportCustomers(fromDate, toDate);
