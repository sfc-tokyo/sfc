// 画像スライダー
document.addEventListener('DOMContentLoaded', function () {
    const header = document.querySelector('header');
    const navToggle = document.querySelector('.js-nav-toggle');
    const navList = document.querySelector('#primary-nav');

    if (header && navToggle && navList) {
        const closeNav = () => {
            header.classList.remove('nav-open');
            navToggle.classList.remove('is-active');
            navToggle.setAttribute('aria-expanded', 'false');
        };

        navToggle.addEventListener('click', () => {
            const isOpen = header.classList.toggle('nav-open');
            navToggle.classList.toggle('is-active', isOpen);
            navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });

        navList.addEventListener('click', (event) => {
            if (event.target.closest('a')) {
                closeNav();
            }
        });

        document.addEventListener('click', (event) => {
            if (header.classList.contains('nav-open') && !header.contains(event.target)) {
                closeNav();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && header.classList.contains('nav-open')) {
                closeNav();
                navToggle.focus();
            }
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 767 && header.classList.contains('nav-open')) {
                closeNav();
            }
        });
    }

    const sliderTrack = document.querySelector('.js-slider');
    if (!sliderTrack) {
        return;
    }

    const sliderWindow = sliderTrack.closest('.slider-window');
    const slides = Array.from(sliderTrack.querySelectorAll('.js-slide'));
    const dots = Array.from(document.querySelectorAll('.js-dot'));
    const prevBtn = sliderWindow?.querySelector('.slider-control--prev');
    const nextBtn = sliderWindow?.querySelector('.slider-control--next');
    let current = 0;
    let autoTimer;
    const interval = 4500;

    const activate = (index) => {
        slides.forEach((slide, idx) => {
            const isActive = idx === index;
            slide.classList.toggle('is-active', isActive);
            slide.setAttribute('aria-hidden', isActive ? 'false' : 'true');
        });
        dots.forEach((dot, idx) => {
            const isActive = idx === index;
            dot.classList.toggle('is-active', isActive);
            dot.setAttribute('aria-current', isActive ? 'true' : 'false');
        });
        sliderTrack.style.transform = `translateX(-${index * 100}%)`;
        current = index;
    };

    const goTo = (index) => {
        if (!slides.length) {
            return;
        }
        const nextIndex = (index + slides.length) % slides.length;
        activate(nextIndex);
    };

    const startAuto = () => {
        if (slides.length < 2) {
            return;
        }
        stopAuto();
        autoTimer = setInterval(() => {
            goTo(current + 1);
        }, interval);
    };

    const stopAuto = () => {
        if (autoTimer) {
            clearInterval(autoTimer);
            autoTimer = null;
        }
    };

    prevBtn?.addEventListener('click', () => {
        goTo(current - 1);
        startAuto();
    });

    nextBtn?.addEventListener('click', () => {
        goTo(current + 1);
        startAuto();
    });

    dots.forEach((dot, idx) => {
        dot.addEventListener('click', () => {
            goTo(idx);
            startAuto();
        });

        dot.addEventListener('mouseenter', stopAuto);
        dot.addEventListener('mouseleave', startAuto);
    });

    sliderWindow?.addEventListener('mouseenter', stopAuto);
    sliderWindow?.addEventListener('mouseleave', startAuto);

    activate(current);
    startAuto();
});
