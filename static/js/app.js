// app.js

document.addEventListener('DOMContentLoaded', () => {

    /* =========================================
       DOM ELEMENTS
       ========================================= */
    const burgerBtn = document.getElementById('burger-menu-btn');
    const navMenu = document.getElementById('nav-menu');

    /* =========================================
       NAVIGATION LOGIC
       ========================================= */
    // Burger Toggle
    if (burgerBtn && navMenu) {
        burgerBtn.addEventListener('click', () => {
            navMenu.classList.toggle('nav-active');
        });
    }

    // Auto-close menu on mobile after selection (for links that might stay on same page)
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (navMenu) navMenu.classList.remove('nav-active');
        });
    });

    /* =========================================
       INIT LOGIC
       ========================================= */
    console.log("CourtAgent Home Page initialized.");
});
