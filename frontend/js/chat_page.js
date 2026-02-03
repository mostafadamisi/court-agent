// chat_page.js

document.addEventListener('DOMContentLoaded', () => {

    /* =========================================
       DOM ELEMENTS
       ========================================= */
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('user-input');
    const chatMessages = document.getElementById('chat-messages');
    const welcomeHero = document.getElementById('welcome-chat-hero');

    // session ID for memory
    let sessionId = sessionStorage.getItem('chat_session_id') || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('chat_session_id', sessionId);

    // Burger Menu Elements
    const burgerBtn = document.getElementById('burger-menu-btn');
    const navMenu = document.getElementById('nav-menu');

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


    /* =========================================
       CHAT LOGIC
       ========================================= */

    function addWelcomeMessage() {
        addMessage("Hello! I'm your AI booking assistant. How can I help you find and book a sports court today?", 'bot');
    }

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;

        // Hide welcome hero on first message
        if (welcomeHero && welcomeHero.parentElement) {
            welcomeHero.remove();
        }

        // 1. Add User Message
        addMessage(text, 'user');
        chatInput.value = '';

        // 2. Add Loading Indicator (Temporary Bot Message)
        const loadingId = addMessage('<div class="typing-indicator"><span></span><span></span><span></span></div>', 'bot', true);

        // 3. Call API
        const timeOfDay = getEffectiveTimeOfDay();
        const data = await window.API.chat(text, timeOfDay, null, sessionId);

        // 4. Remove Loading & Add Real Response
        removeMessage(loadingId);

        if (data) {
            addBotResponse(data);
        } else {
            addMessage("Sorry, I'm having trouble connecting to the server. Is the backend running?", 'bot');
        }
    });

    function addMessage(text, sender, isLoading = false) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}-message slide-in`;
        if (isLoading) {
            msgDiv.id = `msg-${Date.now()}`;
            msgDiv.classList.add('loading');
        }

        const avatarIcon = sender === 'bot' ? '<img src="assets/bot-avatar.png" class="bot-img-avatar">' : '<i class="fa-solid fa-user"></i>';

        msgDiv.innerHTML = `
            <div class="avatar ${sender}-avatar-container">${avatarIcon}</div>
            <div class="content">${text}</div>
        `;

        chatMessages.appendChild(msgDiv);
        scrollToBottom();
        return msgDiv.id;
    }

    function removeMessage(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function addBotResponse(data) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message bot-message slide-in`;
        if (!msgDiv.id) msgDiv.id = `bot-${Date.now()}`;

        // Construct HTML for venues
        let venuesHTML = '';
        if (data.venues && data.venues.length > 0) {
            venuesHTML = `<div class="venues-list">`;
            data.venues.forEach(v => {
                venuesHTML += `
                    <div class="glass-card venue-card-inner">
                        <h3>${v.name}</h3>
                        <p style="opacity:0.8; font-size: 0.9rem;">
                            <i class="fa-solid fa-location-dot"></i> ${v.location} 
                            &bull; 
                            ${v.isIndoor ? '<i class="fa-solid fa-warehouse"></i> Indoor' : '<i class="fa-regular fa-sun"></i> Outdoor'}
                        </p>
                        ${v.aiLabel ? `<div class="ai-badge"><i class="fa-solid fa-wand-magic-sparkles"></i> ${v.aiLabel}</div>` : ''}
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem;">
                            <strong style="font-size:1.1rem; color: #fff;">${v.priceJOD} JOD</strong>
                            <button class="nav-btn book-btn" style="padding:0.3rem 0.8rem; font-size:0.8rem;" 
                                data-venue="${v.name}" 
                                data-price="${v.priceJOD}"
                                data-date="${data.suggestedDate || ''}">Book</button>
                        </div>
                    </div>
                `;
            });
            venuesHTML += `</div>`;
        }

        // Construct HTML for slots
        let slotsHTML = '';
        if (data.slots && data.slots.length > 0) {
            const today = new Date().toISOString().split('T')[0];
            const dateToUse = data.booking_context ? data.booking_context.date : today;
            const venueName = data.booking_context ? data.booking_context.venue : "Venue";

            let slotsGrid = '<div class="time-slots-grid">';
            data.slots.slice(0, 12).forEach(slot => {
                const disabled = !slot.available ? 'disabled' : '';
                slotsGrid += `
                    <button class="time-slot-btn" ${disabled} data-time="${slot.time}">
                        ${slot.time}
                    </button>
                `;
            });
            slotsGrid += '</div>';

            slotsHTML = `
                <div class="slots-container" style="margin-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem;">
                    <div style="margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                        <input type="date" class="availability-date-picker" value="${dateToUse}" min="${today}" style="padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.2); color: white; cursor: pointer;">
                        <small style="opacity: 0.6;">(Change date)</small>
                    </div>
                    ${slotsGrid}
                </div>
            `;
        }

        msgDiv.innerHTML = `
            <div class="avatar bot-avatar-container"><img src="assets/bot-avatar.png" class="bot-img-avatar"></div>
            <div class="content">
                <p>${data.botMessage}</p>
                ${venuesHTML}
                ${slotsHTML}
                <div style="font-size:0.75rem; color:rgba(255,255,255,0.5); padding-top:10px; border-top: 1px solid rgba(255,255,255,0.05); margin-top:10px;">
                    Filter applied: ${data.filterApplied}
                </div>
            </div>
        `;

        chatMessages.appendChild(msgDiv);
        scrollToBottom();

        // Event listeners
        const bookBtns = msgDiv.querySelectorAll('.book-btn');
        bookBtns.forEach(btn => {
            btn.addEventListener('click', () => handleBooking(btn.dataset.venue, btn.dataset.price, btn.dataset.date));
        });

        if (data.slots) {
            const venueName = data.booking_context.venue;
            const price = data.booking_context.price;
            const date = data.booking_context.date;

            const slotBtns = msgDiv.querySelectorAll('.time-slot-btn');
            slotBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    slotBtns.forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    showInlineConfirmForm(msgDiv, venueName, btn.dataset.time, price, date);
                });
            });

            const datePicker = msgDiv.querySelector('.availability-date-picker');
            datePicker.addEventListener('change', (e) => {
                handleBooking(venueName, price, e.target.value);
            });
        }

        if (data.bookingConfirmed) {
            showSuccessPopup("Details have been sent to you.");
        }
    }

    async function handleBooking(venueName, price, preferredDate = null) {
        const today = new Date().toISOString().split('T')[0];
        const dateToUse = preferredDate || today;
        const textToAgent = `Check availability for ${venueName} on ${dateToUse}`;
        const loadingId = addMessage(`Wait a moment...`, 'bot', true);
        const data = await window.API.chat(textToAgent, getEffectiveTimeOfDay(), null, sessionId);
        removeMessage(loadingId);
        if (data) addBotResponse(data);
    }

    function showInlineConfirmForm(container, venue, time, price, date) {
        const existingForm = container.querySelector('.inline-booking-form');
        if (existingForm) existingForm.remove();

        const formDiv = document.createElement('div');
        formDiv.className = 'inline-booking-form';
        formDiv.innerHTML = `
            <p style="font-size: 0.9rem; margin-bottom: 5px;">Confirm details for <strong>${date}</strong> at <strong>${time}</strong> (${price} JOD):</p>
            <input type="text" class="inline-input" id="book-name" placeholder="Your Name" value="Guest User">
            <input type="tel" class="inline-input" id="book-phone" placeholder="Phone Number" value="+962 790 000 000">
            <button class="confirm-booking-btn">Confirm Booking</button>
        `;

        container.querySelector('.content').appendChild(formDiv);
        scrollToBottom();

        formDiv.querySelector('.confirm-booking-btn').addEventListener('click', async () => {
            const name = formDiv.querySelector('#book-name').value;
            const phone = formDiv.querySelector('#book-phone').value;
            const textToAgent = `Finalize my booking: \nVenue: ${venue}\nDate: ${date}\nTime: ${time}\nName: ${name}\nPhone: ${phone}`;
            formDiv.innerHTML = `<p><i class="fa-solid fa-spinner fa-spin"></i> Finalizing with Agent...</p>`;
            const data = await window.API.chat(textToAgent, getEffectiveTimeOfDay(), null, sessionId);

            if (data && data.bookingConfirmed) {
                formDiv.innerHTML = `<p style="color: var(--primary-cyan); font-weight: bold;">✅ Booking Processed!</p>`;
                addBotResponse(data);
                // Trigger the main success popup after a short delay
                setTimeout(() => {
                    showSuccessPopup("Booking details have been sent to your WhatsApp.");
                }, 1500);
            } else if (data) {
                formDiv.innerHTML = `<p style="color: var(--primary-lime);">Agent is processing your request...</p>`;
                addBotResponse(data);
            } else {
                formDiv.innerHTML = `<p style="color: #ff4757;">❌ Connection error. Please try again.</p>`;
            }
        });
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function getEffectiveTimeOfDay() {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return 'Morning';
        if (hour >= 12 && hour < 14) return 'Noon';
        if (hour >= 14 && hour < 18) return 'Afternoon';
        return 'Evening';
    }

    function showSuccessPopup(message = "Your request has been processed successfully.") {
        const overlay = document.createElement('div');
        overlay.className = 'popup-overlay';
        overlay.innerHTML = `
            <div class="popup-content">
                <div class="popup-icon-container">
                    <i class="fa-brands fa-whatsapp popup-whatsapp-icon"></i>
                </div>
                <h2 class="popup-title">Booking Confirmed!</h2>
                <p class="popup-message">${message}</p>
                <div class="popup-whatsapp-note">
                    <span>Details sent to your WhatsApp</span>
                </div>
                <button class="popup-close-btn">Done</button>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('.popup-close-btn').addEventListener('click', () => {
            overlay.remove();
            chatMessages.innerHTML = '';
            addWelcomeMessage();
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
    }

    // Init
    // No longer calling initial addWelcomeMessage here
});
