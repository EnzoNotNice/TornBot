const fetch = require('node-fetch');
const config = require('../config.json');
let lastApiCall = 0;
const MIN_API_DELAY = 700;
let currentDelay = MIN_API_DELAY;
const MAX_BACKOFF_DELAY = 5000;
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function getTimestamp() {
    return new Date().toISOString().replace('T', ' ').substr(0, 19);
}
async function enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCall;
    if (timeSinceLastCall < currentDelay) {
        await sleep(currentDelay - timeSinceLastCall);
    }
    lastApiCall = Date.now();
}
async function tornApiRequest(endpoint) {
    try {
        await enforceRateLimit();
        const separator = endpoint.includes('?') ? '&' : '?';
        const url = `https://api.torn.com/${endpoint}${separator}key=${config.tornApiKey}`;
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`[${getTimestamp()}] HTTP ${response.status}: ${endpoint}`);
            return null;
        }
        const data = await response.json();
        if (data.error) {
            if (data.error.code === 5 || (data.error.error && data.error.error.includes('Too many'))) {
                currentDelay = Math.min(currentDelay * 2, MAX_BACKOFF_DELAY);
                console.warn(`[${getTimestamp()}] ⚠️  Rate limited! Backing off to ${currentDelay}ms (${endpoint})`);
            } else {
                console.error(`[${getTimestamp()}] API error: ${data.error.error} (${endpoint})`);
            }
            return null;
        }
        if (currentDelay > MIN_API_DELAY) {
            currentDelay = Math.max(MIN_API_DELAY, currentDelay - 100);
        }
        return data;
    } catch (error) {
        console.error(`[${getTimestamp()}] Network error (${endpoint}):`, error.message);
        return null;
    }
}
async function tornApiV2Request(endpoint) {
    try {
        await enforceRateLimit();
        const separator = endpoint.includes('?') ? '&' : '?';
        const url = `https://api.torn.com/v2/${endpoint}${separator}key=${config.tornApiKey}`;
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`[${getTimestamp()}] HTTP ${response.status}: v2/${endpoint}`);
            return null;
        }
        const data = await response.json();
        if (data.error) {
            console.error(`[${getTimestamp()}] API error: ${data.error.error} (v2/${endpoint})`);
            return null;
        }
        return data;
    } catch (error) {
        console.error(`[${getTimestamp()}] Network error (v2/${endpoint}):`, error.message);
        return null;
    }
}
module.exports = {
    tornApiRequest,
    tornApiV2Request,
    getTimestamp,
    MIN_API_DELAY
};