import axios from "axios";
import pLimit from "p-limit";
import { config } from "./config.js";

const limit = pLimit(config.requestsPerSecond);

export class MagentoAPI {
  constructor() {
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: config.headers,
    });
  }

  async getOrders(page = 1, fromDate = null, toDate = null) {
    return limit(async () => {
      try {
        const searchCriteria = {
          currentPage: page,
          pageSize: config.pageSize,
          sortOrders: [
            {
              field: "entity_id",
              direction: "desc",
            },
          ],
          filterGroups: [],
        };

        // Add date filters if provided
        if (fromDate) {
          searchCriteria.filterGroups.push({
            filters: [
              {
                field: "created_at",
                value: fromDate,
                conditionType: "gteq",
              },
            ],
          });
        }

        if (toDate) {
          searchCriteria.filterGroups.push({
            filters: [
              {
                field: "created_at",
                value: toDate,
                conditionType: "lteq",
              },
            ],
          });
        }

        const response = await this.client.get("/rest/V1/orders", {
          params: {
            searchCriteria,
          },
        });
        return response.data;
      } catch (error) {
        console.error(`Error fetching orders page ${page}:`, error.message);
        throw error;
      }
    });
  }

  async getCustomers(page = 1, fromDate = null, toDate = null) {
    return limit(async () => {
      try {
        const searchCriteria = {
          currentPage: page,
          pageSize: config.pageSize,
          sortOrders: [
            {
              field: "entity_id",
              direction: "asc",
            },
          ],
          filterGroups: [],
        };

        // Add date filters if provided
        if (fromDate) {
          searchCriteria.filterGroups.push({
            filters: [
              {
                field: "created_at",
                value: fromDate,
                conditionType: "gteq",
              },
            ],
          });
        }

        if (toDate) {
          searchCriteria.filterGroups.push({
            filters: [
              {
                field: "created_at",
                value: toDate,
                conditionType: "lteq",
              },
            ],
          });
        }

        console.log("Debug - Customer API Request:");
        console.log(
          JSON.stringify(
            {
              url: "/rest/V1/customers/search",
              searchCriteria,
            },
            null,
            2
          )
        );

        const response = await this.client.get("/rest/V1/customers/search", {
          params: {
            searchCriteria,
          },
        });

        // Log first few customers' creation dates to verify filtering
        if (response.data.items && response.data.items.length > 0) {
          console.log("\nDebug - Sample customer dates:");
          response.data.items.slice(0, 3).forEach((customer) => {
            console.log(
              `Customer ${customer.email}: created_at = ${customer.created_at}`
            );
          });
        }

        return response.data;
      } catch (error) {
        console.error(`Error fetching customers page ${page}:`, error.message);
        if (error.response?.data) {
          console.error("API Error Response:", error.response.data);
        }
        throw error;
      }
    });
  }

  async getCustomer(customerId) {
    return limit(async () => {
      try {
        const response = await this.client.get(
          `/rest/V1/customers/${customerId}`
        );
        return response.data;
      } catch (error) {
        console.error(`Error fetching customer ${customerId}:`, error.message);
        return null;
      }
    });
  }

  async getOrderTransactions(orderId) {
    return limit(async () => {
      try {
        const response = await this.client.get(
          `/rest/V1/transactions?searchCriteria[filter_groups][0][filters][0][field]=order_id&searchCriteria[filter_groups][0][filters][0][value]=${orderId}`
        );
        return response.data;
      } catch (error) {
        console.error(
          `Error fetching transactions for order ${orderId}:`,
          error.message
        );
        return { items: [] };
      }
    });
  }

  async getCustomerOrders(customerId) {
    try {
      const response = await this.client.get(`/rest/V1/orders`, {
        params: {
          searchCriteria: {
            filterGroups: [
              {
                filters: [
                  {
                    field: "customer_id",
                    value: customerId,
                    condition_type: "eq",
                  },
                ],
              },
            ],
          },
        },
      });
      return response.data.items || [];
    } catch (error) {
      console.error(`Error fetching orders for customer ${customerId}:`, error);
      throw error;
    }
  }
}
