import axios from 'axios';
import pLimit from 'p-limit';
import { config } from './config.js';

const limit = pLimit(config.requestsPerSecond);

export class MagentoAPI {
    constructor() {
        this.client = axios.create({
            baseURL: config.baseUrl,
            headers: config.headers
        });
    }

    async getOrders(page = 1) {
        return limit(async () => {
            try {
                const response = await this.client.get('/rest/V1/orders', {
                    params: {
                        searchCriteria: {
                            currentPage: page,
                            pageSize: config.pageSize,
                            sortOrders: [{
                                field: 'entity_id',
                                direction: 'desc'
                            }]
                        }
                    }
                });
                return response.data;
            } catch (error) {
                console.error(`Error fetching orders page ${page}:`, error.message);
                throw error;
            }
        });
    }

    async getCustomers(page = 1) {
        return limit(async () => {
            try {
                const response = await this.client.get('/rest/V1/customers/search', {
                    params: {
                        searchCriteria: {
                            currentPage: page,
                            pageSize: config.pageSize,
                            sortOrders: [{
                                field: 'entity_id',
                                direction: 'asc'
                            }]
                        }
                    }
                });
                return response.data;
            } catch (error) {
                console.error(`Error fetching customers page ${page}:`, error.message);
                throw error;
            }
        });
    }

    async getCustomer(customerId) {
        return limit(async () => {
            try {
                const response = await this.client.get(`/rest/V1/customers/${customerId}`);
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
                const response = await this.client.get(`/rest/V1/transactions?searchCriteria[filter_groups][0][filters][0][field]=order_id&searchCriteria[filter_groups][0][filters][0][value]=${orderId}`);
                return response.data;
            } catch (error) {
                console.error(`Error fetching transactions for order ${orderId}:`, error.message);
                return { items: [] };
            }
        });
    }
}
