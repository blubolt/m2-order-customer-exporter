import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const config = {
    baseUrl: process.env.MAGENTO_BASE_URL,
    accessToken: process.env.MAGENTO_ACCESS_TOKEN,
    requestsPerSecond: parseInt(process.env.REQUESTS_PER_SECOND || '2', 10),
    pageSize: parseInt(process.env.PAGE_SIZE || '50', 10),
    exportDir: join(__dirname, '..', 'exports'),
    headers: {
        'Authorization': `Bearer ${process.env.MAGENTO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
    }
};
