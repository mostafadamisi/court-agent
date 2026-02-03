// admin_page.js

document.addEventListener('DOMContentLoaded', () => {

    /* =========================================
       DOM ELEMENTS
       ========================================= */
    // Burger Menu Elements
    const burgerBtn = document.getElementById('burger-menu-btn');
    const navMenu = document.getElementById('nav-menu');
    const refreshBtn = document.getElementById('refresh-metrics-btn');

    // Admin Metrics Elements
    const metricRevenue = document.getElementById('metric-revenue');
    const metricBookings = document.getElementById('metric-bookings');
    const metricTopVenue = document.getElementById('metric-top-venue');
    const metricAvgValue = document.getElementById('metric-avg-value');
    const metricActiveInquiries = document.getElementById('metric-active-inquiries');
    const metricConversionRate = document.getElementById('metric-conversion-rate');
    const metricPeakTime = document.getElementById('metric-peak-time');
    const metricReturningUsers = document.getElementById('metric-returning-users');

    const systemTimeSelect = document.getElementById('system-time-select');
    const systemTimeStatus = document.getElementById('system-time-status');

    /* =========================================
       ADMIN LOGIC
       ========================================= */
    async function loadAdminMetrics() {
        if (!window.API) {
            console.error("API client not found. Make sure api.js is loaded.");
            return;
        }

        // Show loading state
        const valueElements = [
            metricRevenue, metricBookings, metricAvgValue,
            metricActiveInquiries, metricConversionRate, metricReturningUsers,
            metricTopVenue, metricPeakTime
        ];

        valueElements.forEach(el => {
            if (el && !el.innerText.includes('Loading')) {
                el.style.opacity = '0.5';
            }
        });

        const data = await window.API.getMetrics();

        valueElements.forEach(el => {
            if (el) el.style.opacity = '1';
        });

        if (data) {
            // Animated metrics
            animateValue(metricRevenue, data.monthly_revenue_jod, ' JOD');
            animateValue(metricBookings, data.total_bookings_this_month, '');
            animateValue(metricAvgValue, data.average_booking_value_jod, ' JOD');
            animateValue(metricActiveInquiries, data.active_inquiries, '');
            animateValue(metricConversionRate, data.conversion_rate_percent, '%');
            animateValue(metricReturningUsers, data.returning_users_percent, '%');

            // Static text metrics
            if (metricTopVenue) metricTopVenue.innerText = data.top_venue_this_month;
            if (metricPeakTime) metricPeakTime.innerText = data.peak_booking_time;

            // Sync settings UI
            if (data.system_time_override) {
                if (systemTimeSelect) systemTimeSelect.value = data.system_time_override;
                if (systemTimeStatus) {
                    systemTimeStatus.innerText = data.system_time_override;
                    systemTimeStatus.style.color = "#3cedc7";
                }
            } else {
                if (systemTimeSelect) systemTimeSelect.value = "Auto";
                if (systemTimeStatus) {
                    systemTimeStatus.innerText = "Auto";
                    systemTimeStatus.style.color = "#fff";
                }
            }
        }
    }

    function animateValue(element, end, suffix) {
        if (!element) return;
        let current = 0;
        const duration = 1000;
        const start = 0;
        const range = end - start;

        // If range is large or end is same, just set it
        if (range === 0) {
            element.innerText = end + suffix;
            return;
        }

        let startTime = null;

        function step(timestamp) {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            const value = (progress * range) + start;

            // Format number (1 decimal for small floats)
            const displayValue = Math.abs(range) < 100 && !Number.isInteger(end)
                ? value.toFixed(1)
                : Math.floor(value);

            element.innerText = displayValue + suffix;

            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                element.innerText = end + suffix;
            }
        }
        window.requestAnimationFrame(step);
    }

    /* =========================================
       EVENT LISTENERS
       ========================================= */
    // Burger Toggle
    if (burgerBtn && navMenu) {
        burgerBtn.addEventListener('click', () => {
            navMenu.classList.toggle('nav-active');
        });
    }

    // Auto-close menu on mobile after selection
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (navMenu) navMenu.classList.remove('nav-active');
        });
    });

    // Refresh Button
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadAdminMetrics();
        });
    }

    // System Time Override Logic
    if (systemTimeSelect) {
        systemTimeSelect.addEventListener('change', async (e) => {
            const value = e.target.value;
            if (systemTimeStatus) {
                systemTimeStatus.innerText = value;
                systemTimeStatus.style.color = value === "Auto" ? "#fff" : "#3cedc7";
            }

            await window.API.updateSettings({
                system_time_override: value
            });
        });
    }

    /* =========================================
       INIT LOGIC
       ========================================= */
    loadAdminMetrics(); // Initial metrics load
});
