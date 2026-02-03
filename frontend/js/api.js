/**
 * API Client for interacting with the Python Backend
 */

// For Render Deployment: Use empty string for same-origin calls
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : ''; // Empty string means it will use the same URL as the website

const API = {
    /**
     * Get all venues
     */
    async getVenues() {
        try {
            const response = await fetch(`${API_BASE_URL}/venues`);
            if (!response.ok) throw new Error('Failed to fetch venues');
            return await response.json();
        } catch (error) {
            console.error("API Error (getVenues):", error);
            return [];
        }
    },

    /**
     * Get venue availability
     * @param {string} venueName 
     * @param {string} date - YYYY-MM-DD
     */
    async getAvailability(venueName, date) {
        try {
            const encodedName = encodeURIComponent(venueName);
            const url = date
                ? `${API_BASE_URL}/availability/${encodedName}?date=${date}`
                : `${API_BASE_URL}/availability/${encodedName}`;

            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch availability');
            return await response.json();
        } catch (error) {
            console.error("API Error (getAvailability):", error);
            return null;
        }
    },

    /**
     * Send a user message to the AI Chat endpoint
     * @param {string} message - User's query
     * @param {string} timeOfDay - Filter: Morning, Noon, Afternoon, Evening
     * @param {string} location - Optional location filter
     * @param {string} sessionId - Unique identifier for the chat session
     */
    async chat(message, timeOfDay = "Afternoon", location = null, sessionId = "default") {
        try {
            const response = await fetch(`${API_BASE_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, timeOfDay, location, sessionId })
            });
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error("API Error (Chat):", error);
            return null;
        }
    },

    /**
     * Create a booking
     * @param {Object} bookingData - { venue, date, time, userName, phone }
     */
    async createBooking(bookingData) {
        try {
            const response = await fetch(`${API_BASE_URL}/booking`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingData)
            });
            if (!response.ok) throw new Error('Failed to create booking');
            return await response.json();
        } catch (error) {
            console.error("API Error (createBooking):", error);
            return { success: false, message: error.message };
        }
    },

    /**
     * Connect WhatsApp (Simulation)
     */
    async connectWhatsApp() {
        try {
            const response = await fetch(`${API_BASE_URL}/whatsapp/connect`, {
                method: 'POST'
            });
            if (!response.ok) throw new Error('Failed to connect WhatsApp');
            return await response.json();
        } catch (error) {
            console.error("API Error (connectWhatsApp):", error);
            return { success: false };
        }
    },

    /**
     * Fetch Admin Metrics
     */
    async getMetrics() {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/metrics`);
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error("API Error (Metrics):", error);
            // Fallback sample data for demo purposes
            return {
                "monthly_revenue_jod": 4500,
                "total_bookings_this_month": 186,
                "average_booking_value_jod": 24.2,
                "active_inquiries": 12,
                "conversion_rate_percent": 38,
                "top_venue_this_month": "Trax Padel",
                "peak_booking_time": "8:00 PM – 10:00 PM",
                "returning_users_percent": 42
            };
        }
    },

    /**
     * Update Admin Settings
     * @param {Object} settings - { system_time_override, court_3_maintenance }
     */
    async updateSettings(settings) {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (!response.ok) throw new Error('Failed to update settings');
            return await response.json();
        } catch (error) {
            console.error("API Error (updateSettings):", error);
            return null;
        }
    }
};

// Expose to window for easy access if needed (or just use module)
window.API = API;
