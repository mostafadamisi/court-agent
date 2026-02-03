// admin_page.js

document.addEventListener('DOMContentLoaded', () => {

    /* =========================================
       DOM ELEMENTS
       ========================================= */
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

    // Venue Management Elements
    const venuesListBody = document.getElementById('venues-list-body');
    const addVenueBtn = document.getElementById('add-venue-btn');
    const venueModal = document.getElementById('venue-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const addVenueForm = document.getElementById('add-venue-form');
    const venueSearchInput = document.getElementById('venue-search');

    // Custom Confirm Modal Elements
    const confirmModal = document.getElementById('confirm-modal');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmProceedBtn = document.getElementById('confirm-proceed-btn');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');

    // State
    let allVenues = [];
    let pendingDeleteName = null;

    /* =========================================
       UX HELPERS
       ========================================= */

    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';

        toast.innerHTML = `
            <i class="fa-solid ${icon}"></i>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        // Remove toast after 3s
        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    function showConfirm(message, proceedCallback) {
        confirmMessage.innerText = message;
        confirmModal.style.display = 'flex';

        const cleanup = () => {
            confirmModal.style.display = 'none';
            confirmProceedBtn.onclick = null;
        };

        confirmCancelBtn.onclick = cleanup;
        confirmProceedBtn.onclick = () => {
            proceedCallback();
            cleanup();
        };
    }

    /* =========================================
       ADMIN LOGIC
       ========================================= */
    async function loadAdminMetrics() {
        if (!window.API) return;

        const data = await window.API.getMetrics();
        if (data) {
            animateValue(metricRevenue, data.monthly_revenue_jod, ' JOD');
            animateValue(metricBookings, data.total_bookings_this_month, '');
            animateValue(metricAvgValue, data.average_booking_value_jod, ' JOD');
            animateValue(metricActiveInquiries, data.active_inquiries, '');
            animateValue(metricConversionRate, data.conversion_rate_percent, '%');
            animateValue(metricReturningUsers, data.returning_users_percent, '%');

            if (metricTopVenue) metricTopVenue.innerText = data.top_venue_this_month;
            if (metricPeakTime) metricPeakTime.innerText = data.peak_booking_time;

            if (data.system_time_override) {
                if (systemTimeSelect) systemTimeSelect.value = data.system_time_override;
                if (systemTimeStatus) {
                    systemTimeStatus.innerText = data.system_time_override;
                    systemTimeStatus.style.color = "#3cedc7";
                }
            }
        }
    }

    async function loadVenues() {
        if (!window.API) return;

        // Show minimal loading state
        if (venuesListBody && venuesListBody.children.length === 0) {
            venuesListBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; opacity: 0.5;"><i class="fa-solid fa-spinner fa-spin"></i> Loading venues...</td></tr>';
        }

        allVenues = await window.API.getVenues();
        renderVenues(allVenues);
    }

    function renderVenues(venues) {
        if (!venuesListBody) return;

        if (venues.length === 0) {
            venuesListBody.innerHTML = `
                <tr>
                    <td colspan="6">
                        <div class="admin-empty-state">
                            <i class="fa-solid fa-folder-open"></i>
                            <p>No venues found matching your search.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        venuesListBody.innerHTML = venues.map(v => `
            <tr>
                <td><strong>${v.name}</strong></td>
                <td>${v.city}${v.district ? `, ${v.district}` : ''}</td>
                <td><span class="ai-badge" style="background: rgba(255,255,255,0.05); color: #fff; padding: 2px 8px; font-size: 10px;">${v.type}</span></td>
                <td>${v.priceJOD} JOD</td>
                <td>${v.isIndoor ? '<i class="fa-solid fa-warehouse"></i> Indoor' : '<i class="fa-regular fa-sun"></i> Outdoor'}</td>
                <td style="text-align: right;">
                    <button class="action-btn delete" data-name="${v.name}" title="Delete Venue">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        // Add delete listeners
        venuesListBody.querySelectorAll('.delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const name = btn.dataset.name;
                const row = btn.closest('tr');

                showConfirm(`Are you sure you want to remove "${name}" from the database?`, async () => {
                    // Add deleting class for animation
                    row.classList.add('row-deleting');

                    const res = await window.API.deleteVenue(name);

                    if (res && (res.status === 'success' || res.success)) {
                        // Wait for animation to finish before removing from DOM
                        setTimeout(() => {
                            row.remove();
                            // Update internal state
                            allVenues = allVenues.filter(v => v.name !== name);
                            showToast(`"${name}" removed successfully.`);

                            // Check if empty now
                            if (allVenues.length === 0) {
                                renderVenues([]);
                            }
                        }, 500);
                    } else {
                        row.classList.remove('row-deleting');
                        showToast(res.message || "Failed to delete venue.", 'error');
                    }
                });
            });
        });
    }

    function animateValue(element, end, suffix) {
        if (!element) return;
        let start = 0;
        const duration = 1000;
        const range = end - start;
        if (range === 0) {
            element.innerText = end + suffix;
            return;
        }
        let startTime = null;
        function step(timestamp) {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            const value = (progress * range) + start;
            const displayValue = Math.abs(range) < 100 && !Number.isInteger(end) ? value.toFixed(1) : Math.floor(value);
            element.innerText = displayValue + suffix;
            if (progress < 1) window.requestAnimationFrame(step);
            else element.innerText = end + suffix;
        }
        window.requestAnimationFrame(step);
    }

    /* =========================================
       EVENT LISTENERS
       ========================================= */
    if (burgerBtn && navMenu) {
        burgerBtn.addEventListener('click', () => navMenu.classList.toggle('nav-active'));
    }

    if (addVenueBtn) {
        addVenueBtn.addEventListener('click', () => {
            venueModal.style.display = 'flex';
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            venueModal.style.display = 'none';
        });
    }

    if (addVenueForm) {
        addVenueForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = e.target.querySelector('button[type="submit"]');

            const venueData = {
                name: document.getElementById('v-name').value,
                city: document.getElementById('v-city').value,
                district: document.getElementById('v-district').value,
                type: document.getElementById('v-type').value,
                priceJOD: parseFloat(document.getElementById('v-price').value),
                isIndoor: document.getElementById('v-isIndoor').checked
            };

            submitBtn.classList.add('btn-loading');

            const res = await window.API.addVenue(venueData);

            submitBtn.classList.remove('btn-loading');

            if (res && (res.status === 'success' || res.success)) {
                venueModal.style.display = 'none';
                addVenueForm.reset();
                showToast(`Venue "${venueData.name}" added successfully!`);
                loadVenues();
            } else {
                showToast(res.message || "Failed to add venue. Name might already exist.", 'error');
            }
        });
    }

    if (venueSearchInput) {
        venueSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = allVenues.filter(v =>
                v.name.toLowerCase().includes(query) ||
                (v.city && v.city.toLowerCase().includes(query)) ||
                (v.district && v.district.toLowerCase().includes(query)) ||
                v.type.toLowerCase().includes(query)
            );
            renderVenues(filtered);
        });
    }

    if (systemTimeSelect) {
        systemTimeSelect.addEventListener('change', async (e) => {
            const value = e.target.value;
            if (systemTimeStatus) {
                systemTimeStatus.innerText = value;
                systemTimeStatus.style.color = value === "Auto" ? "#fff" : "#3cedc7";
            }
            const res = await window.API.updateSettings({ system_time_override: value });
            if (res) showToast(`System time updated to ${value}`);
        });
    }

    /* =========================================
       INIT LOGIC
       ========================================= */
    loadAdminMetrics();
    loadVenues();
});
