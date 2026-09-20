// ============================================================
// Siachen Mark — Landing Page JavaScript
// ============================================================
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  setupNavbar();
  setupInstallButtons();
  setupMobileMenu();
});

// ── Navbar scroll effect ──────────────────────────────────
function setupNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.style.background = 'rgba(10,22,40,0.98)';
      navbar.style.boxShadow = '0 4px 30px rgba(0,0,0,.4)';
    } else {
      navbar.style.background = 'rgba(10,22,40,0.85)';
      navbar.style.boxShadow = 'none';
    }
  });
}

// ── Install Extension Buttons ─────────────────────────────
function setupInstallButtons() {
  const downloadUrl = 'https://siachen-mark.vercel.app/downloads/siachen-mark-extension.zip';
  const installBtns = document.querySelectorAll('#btn-install-ext, #btn-cta-ext, #btn-install-dash, #btn-install-ext-dash');
  installBtns.forEach(btn => {
    if (!btn) return;
    btn.setAttribute('href', downloadUrl);
    btn.setAttribute('target', '_blank');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = downloadUrl;
    });
  });
}

// ── Mobile Menu ───────────────────────────────────────────
function setupMobileMenu() {
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.querySelector('.nav-links');
  if (!hamburger || !navLinks) return;

  hamburger.addEventListener('click', () => {
    const isOpen = navLinks.style.display === 'flex';
    navLinks.style.display = isOpen ? 'none' : 'flex';
    navLinks.style.flexDirection = 'column';
    navLinks.style.position = 'absolute';
    navLinks.style.top = '64px';
    navLinks.style.left = '0';
    navLinks.style.right = '0';
    navLinks.style.background = '#0F1E33';
    navLinks.style.padding = '16px 24px';
    navLinks.style.borderBottom = '1px solid #1E3A5F';
    navLinks.style.gap = '12px';
  });
}
