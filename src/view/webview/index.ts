/**
 * Webview entry file
 * 
 * Import main app component to trigger all custom element registrations
 */

import './components/sidebar-app.js';

// Export types for external use
export * from './types.js';

// Global context menu disable
document.addEventListener('contextmenu', event => event.preventDefault());

// Smart Tooltip Positioning System
document.addEventListener('mouseover', (event) => {
    const target = event.target as HTMLElement;
    const tooltipElement = target.closest('[data-tooltip]') as HTMLElement;

    if (tooltipElement) {
        const rect = tooltipElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const threshold = 180; // Approximate max width of tooltip

        // Check right edge collision
        // If element is close to the right edge (< 180px space), force alignment to RIGHT (tooltip grows left)
        if (rect.right + threshold > viewportWidth) {
            tooltipElement.setAttribute('data-placement', 'right');
        }
        // Check left edge collision
        // If element is close to the left edge (< 180px space), force alignment to LEFT (tooltip grows right)
        else if (rect.left - threshold < 0) {
            tooltipElement.setAttribute('data-placement', 'left');
        }
        // Otherwise clear any placement override (default center)
        else {
            tooltipElement.removeAttribute('data-placement');
        }
    }
});
