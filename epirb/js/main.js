/* ============================================================
   RALA-EPIRB — Accessible & Progressive Enhancement Script
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // Mark HTML as JS-enabled for progressive reveal
  document.documentElement.classList.add('js');

  const nav = document.querySelector('.nav');
  const menuBtn = document.querySelector('.nav__menu-btn');
  const navLinks = document.querySelector('.nav__links');

  // SVG Icons for Mobile Toggle
  const iconHamburger = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 12h18M3 6h18M3 18h18"/></svg>';
  const iconClose = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>';

  /* --- Navbar scroll background state --- */
  const onScroll = () => {
    if (nav) {
      nav.classList.toggle('scrolled', window.scrollY > 20);
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* --- Accessible Mobile Navigation --- */
  const closeMenu = (restoreFocus = true) => {
    if (navLinks && navLinks.classList.contains('open')) {
      navLinks.classList.remove('open');
      document.body.classList.remove('menu-open');
      if (menuBtn) {
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.innerHTML = iconHamburger;
        if (restoreFocus) {
          menuBtn.focus();
        }
      }
    }
  };

  const openMenu = () => {
    if (navLinks) {
      navLinks.classList.add('open');
      document.body.classList.add('menu-open');
      if (menuBtn) {
        menuBtn.setAttribute('aria-expanded', 'true');
        menuBtn.innerHTML = iconClose;
      }
    }
  };

  if (menuBtn && navLinks) {
    menuBtn.addEventListener('click', () => {
      const isOpen = navLinks.classList.contains('open');
      if (isOpen) {
        closeMenu(false);
      } else {
        openMenu();
      }
    });

    // Close menu on link click (including "Discuss Licensing")
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        closeMenu(false);
      });
    });

    // Escape key closes menu
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navLinks.classList.contains('open')) {
        closeMenu(true);
      }
    });

    // Resize listener: if window resized > 1024px, close menu and reset
    window.addEventListener('resize', () => {
      if (window.innerWidth > 1024 && navLinks.classList.contains('open')) {
        closeMenu(false);
      }
    });
  }

  /* --- Safe Smooth Scrolling for Anchors --- */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href');
      if (!href || href === '#') return;

      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const navHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 72;
        const targetTop = target.getBoundingClientRect().top + window.scrollY - navHeight - 16;
        
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({
          top: targetTop,
          behavior: prefersReducedMotion ? 'auto' : 'smooth'
        });
      }
    });
  });

  /* --- Intersection Observer for Reveal (If Motion Allowed) --- */
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveals = document.querySelectorAll('.reveal');

  if (!prefersReducedMotion && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -30px 0px'
    });
    reveals.forEach(el => observer.observe(el));
  } else {
    // If reduced motion is set or observer not supported, show immediately
    reveals.forEach(el => el.classList.add('visible'));
  }

  /* --- Active Nav Link Highlighting --- */
  const sections = document.querySelectorAll('section[id]');
  const navLinksAll = document.querySelectorAll('.nav__link[href^="#"]');

  const updateActiveLink = () => {
    const scrollY = window.scrollY + 120;
    let currentId = '';

    sections.forEach(section => {
      if (section.offsetTop <= scrollY) {
        currentId = section.id;
      }
    });

    navLinksAll.forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === '#' + currentId);
    });
  };

  window.addEventListener('scroll', updateActiveLink, { passive: true });
  updateActiveLink();

  /* --- Form Submission Handling --- */
  const enquiryForm = document.getElementById('enquiry-form');
  const formStatus = document.getElementById('form-status');

  if (enquiryForm) {
    const actionUrl = enquiryForm.getAttribute('action') || '';
    const isConfigured = actionUrl.includes('formspree.io') && !actionUrl.includes('YOUR_FORMSPREE_ID');

    // If endpoint is unconfigured, notify directly in status container without fake demo responses
    if (!isConfigured && formStatus) {
      formStatus.className = 'form-status form-status--info';
      formStatus.innerHTML = 'Online enquiries are currently being configured. Please contact <a href="mailto:info@rala-epirb.com" style="color: currentColor; text-decoration: underline;">info@rala-epirb.com</a> directly.';
    }

    enquiryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (!isConfigured) {
        if (formStatus) {
          formStatus.className = 'form-status form-status--info';
          formStatus.innerHTML = 'Online enquiries are currently being configured. Please contact <a href="mailto:info@rala-epirb.com" style="color: currentColor; text-decoration: underline;">info@rala-epirb.com</a> directly.';
        }
        return;
      }

      const submitBtn = enquiryForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn ? submitBtn.textContent : 'Discuss Licensing';

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Transmitting...';
      }

      if (formStatus) {
        formStatus.className = 'form-status';
        formStatus.textContent = '';
      }

      try {
        const formData = new FormData(enquiryForm);
        const response = await fetch(actionUrl, {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          if (formStatus) {
            formStatus.className = 'form-status form-status--success';
            formStatus.textContent = 'Thank you for your enquiry. Your message has been sent successfully.';
          }
          enquiryForm.reset();
        } else {
          throw new Error('Server returned an error.');
        }
      } catch (err) {
        if (formStatus) {
          formStatus.className = 'form-status form-status--error';
          formStatus.innerHTML = 'An error occurred while transmitting your message. Please try again or email <a href="mailto:info@rala-epirb.com" style="color: currentColor; text-decoration: underline;">info@rala-epirb.com</a> directly.';
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
        }
      }
    });
  }
});
