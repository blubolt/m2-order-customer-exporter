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

    async getOrders(page = 1, options = {}) {
        const { createdFrom } = options;
        return limit(async () => {
            try {
                const searchCriteria = {
                    currentPage: page,
                    pageSize: config.pageSize,
                    sortOrders: [{
                        field: 'entity_id',
                        direction: 'desc'
                    }]
                };

                if (createdFrom) {
                    // Add created_at >= createdFrom filter
                    searchCriteria.filter_groups = [
                        {
                            filters: [
                                {
                                    field: 'created_at',
                                    value: createdFrom,
                                    condition_type: 'gteq'
                                }
                            ]
                        }
                    ];
                }

                const requestParams = { searchCriteria };

                console.log(`📡 Fetching orders page ${page}${createdFrom ? ` (from ${createdFrom})` : ''}...`);

                const response = await this.client.get('/rest/V1/orders', {
                    params: requestParams
                });

                console.log(`✅ Retrieved ${response.data.items?.length || 0} orders (Total: ${response.data.total_count || 'unknown'})`);

                return response.data;
            } catch (error) {
                console.error(`❌ Error fetching orders page ${page}:`);
                console.error(`   Error Message: ${error.message}`);
                console.error(`   Response Status: ${error.response?.status || 'N/A'}`);

                if (error.response?.data) {
                    console.error(`   Response Data:`, JSON.stringify(error.response.data, null, 2));
                }

                if (error.response?.status === 401) {
                    console.error(`   🔐 Authentication Error - Check your access token`);
                } else if (error.response?.status === 403) {
                    console.error(`   🚫 Permission Error - Check API permissions`);
                } else if (error.response?.status === 404) {
                    console.error(`   🔍 Not Found Error - Check the API endpoint`);
                }

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
                console.error(`❌ Error fetching transactions for order ${orderId}:`, error.message);
                return { items: [] };
            }
        });
    }

    async getOrderShipments(orderId) {
        return limit(async () => {
            try {
                const response = await this.client.get(`/rest/V1/shipments?searchCriteria[filter_groups][0][filters][0][field]=order_id&searchCriteria[filter_groups][0][filters][0][value]=${orderId}`);
                return response.data;
            } catch (error) {
                console.error(`❌ Error fetching shipments for order ${orderId}:`, error.message);
                return { items: [] };
            }
        });
    }

    async testConnection() {
        console.log('🔍 Testing API connection...');
        try {
            // Try a simple store configuration request first
            const storeResponse = await this.client.get('/rest/V1/store/storeConfigs');

            // Try orders endpoint with minimal parameters to test access
            const testOrdersResponse = await this.client.get('/rest/V1/orders', {
                params: {
                    searchCriteria: {
                        currentPage: 1,
                        pageSize: 1
                    }
                }
            });

            console.log(`✅ API Test Passed - ${testOrdersResponse.data.total_count || 'unknown'} orders available`);

            return true;
        } catch (error) {
            console.error(`❌ API Connection Test Failed:`);
            console.error(`   Error: ${error.message}`);
            console.error(`   Status: ${error.response?.status || 'N/A'}`);

            if (error.response?.data) {
                console.error(`   Error Details:`, JSON.stringify(error.response.data, null, 2));
            }

            return false;
        }
    }
}
