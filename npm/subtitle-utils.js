/**
 * HLS Video Player - Subtitle Utilities
 * Shared utilities for subtitle/caption styling and rendering
 */

/**
 * Convert hex color to rgba with opacity
 * @param {string} hex - Hex color code (e.g., '#ffffff' or '#fff')
 * @param {number} opacity - Opacity percentage (0-100)
 * @returns {string} RGBA color string
 */
function hexToRgba(hex, opacity) {
  // Expand shorthand form (e.g. "#fff" → "#ffffff")
  if (hex.length === 4) {
    hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  
  // Validate hex format
  if (!/^#[0-9A-F]{6}$/i.test(hex)) {
    console.warn(`Invalid hex color: ${hex}, using fallback #000000`);
    hex = '#000000';
  }
  
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
}

/**
 * Get text-shadow CSS for edge style
 * @param {string} edgeStyle - Edge style type ('none', 'shadow', 'raised', 'depressed', 'outline')
 * @returns {string} CSS text-shadow value
 */
function getEdgeStyleCSS(edgeStyle) {
  const edgeStyles = {
    shadow: '2px 2px 4px rgba(0, 0, 0, 0.9)',
    raised: '1px 1px 0 #000, 2px 2px 0 #333',
    depressed: '-1px -1px 0 #000, -2px -2px 0 #333',
    outline: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
    none: 'none',
  };
  
  return edgeStyles[edgeStyle] || edgeStyles.none;
}

/**
 * Validate subtitle settings object
 * @param {Object} settings - Subtitle settings to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateSubtitleSettings(settings) {
  if (!settings || typeof settings !== 'object') {
    return false;
  }
  
  const requiredFields = ['fontSize', 'fontColor', 'backgroundColor', 'backgroundOpacity', 'fontFamily', 'edgeStyle'];
  return requiredFields.every(field => field in settings);
}

// Export for use in other modules (when using module bundler or global scope)
if (typeof window !== 'undefined') {
  window.SubtitleUtils = {
    hexToRgba,
    getEdgeStyleCSS,
    validateSubtitleSettings,
  };
}
