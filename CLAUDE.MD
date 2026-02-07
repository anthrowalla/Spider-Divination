# Spider Divination IV

## Project Overview
This is a web-based implementation of an African spider divination system, originally created as a Java applet in 1998-1999 and converted to modern JavaScript in 2026. The application simulates traditional divination practices using interactive cards, a spider bowl, and various cultural symbols.

## Quick Reference
**To run:** Open `index.html` via an HTTP server (required for asset loading)
**Main code:** `spider.js` (30KB, ES6 JavaScript)
**Total cards:** 42 divination cards with interpretations
**Canvas size:** 520x398 pixels
**Assets:** LgGifs/ and MedGifs/ folders contain card images

## Project Structure

### Core Files
- `index.html` - Main application interface with canvas-based bowl visualization
- `spider.js` - JavaScript implementation of the divination logic and UI controls
- `gong.mp3` / `gong.au` - Sound effects for the divination process

### Assets
- `Captions/` - Card caption text files (42 .txt files, one per card)
- `LgGifs/` - Large GIF images for card details (42 leaf images, leaf1.gif through leaf42.gif)
- `MedGifs/` - Medium-sized GIF images for tableau display (42 leaf images plus special images: leafblank.gif, leafstack.gif, leafside.gif, leafhole.gif)
- `thumbs/` - Thumbnail images directory (currently empty)
- `spiderbowl2.gif` - Spider bowl background image (76KB GIF from 1999)
- `cover.gif` - Cover/title image (73KB GIF from 1998)
- `NewSpiderBowl.jpg` - High-resolution bowl image (268KB, 2026)
- `NewSpiderBowl_bw.jpg` - Black and white bowl variation (395KB, 2026)
- `NewSpiderBowl_sep.jpg` - Sepia bowl variation (256KB, 2026)

### Documentation
- `muyandre.txt` - Cultural/historical reference text (11KB, from 1999)
- `nggwa.txt` - Cultural/historical reference text (3.5KB, from 1999)
- `CLAUDE.md` - This file, project documentation for AI assistance

### Development Configuration
- `.claude/` - Claude Code configuration directory
- `.claude/settings.local.json` - Local Claude Code settings

### Legacy Files
- `SpiderV.jar` - Original Java applet
- `Spider Divination IV (mac)` - Original Mac executable
- `SpiderV.zip` - Packaged distribution
- `SpiderV.html` / `SpiderVZip.html` - Original Java applet HTML wrappers

## Code Architecture

### JavaScript Organization (spider.js)
The code is organized into clear sections:
1. **Configuration** - CONFIG object with all constants and settings
2. **State Management** - Global state object tracking application state
3. **Card Class** - Object-oriented card representation with methods
4. **Initialization** - DOM setup, event listeners, asset preloading
5. **Game Logic** - Divination mechanics, card shuffling, tableau management
6. **Rendering** - Canvas drawing functions for bowl and cards
7. **Event Handlers** - Mouse interactions, button clicks, UI updates
8. **Utility Functions** - Helper functions for geometry, collisions, etc.

### Event Flow
1. Page loads → `init()` called → Assets preloaded
2. User clicks "Start" → Cards shuffled and placed in bowl
3. Spider animation → Cards randomly moved/rotated
4. Cards land → Check positions relative to stick/stone/hole
5. User clicks card → Modal shows large image and interpretation
6. Tableau builds → Up to 7 cards displayed in side panel

## Technical Details

### Application Features
1. **Interactive Canvas** (520x398px)
   - Spider bowl visualization
   - Clickable cards
   - Visual elements: stick, stone, hole
   - Hover states and tooltips

2. **Card System**
   - 42 total divination cards (leaf1.gif through leaf42.gif)
   - Two image sizes: Medium (for canvas display) and Large (for detail modal)
   - Card interpretations stored in text files (Captions directory)
   - Click on any card to view detailed card information in modal overlay
   - Cards have rotation angles and position tracking

3. **Controls**
   - Review mode with optional 2x speed
   - Pause/Stop functionality
   - Start/Reset divination
   - Spider animation trigger
   - Show tableau
   - Lottery Mode option

4. **UI Components**
   - Tableau list (side panel, max 7 items)
   - Info panel for card interpretations
   - Status bar with loading indicators
   - Modal overlay for card details
   - Cover image (can be shown/hidden over bowl)
   - Special UI images: leafblank.gif, leafstack.gif, leafside.gif, leafhole.gif

### Color Scheme
- Background: `#2a1810` (dark brown)
- Borders: `#654321` (medium brown)
- UI elements: `#d4c4a8` (tan/beige)
- Highlights: `#e8dcc4` (light tan)
- Info panels: `#1a0f0a` (very dark brown)

## Development Notes

### Configuration
The `spider.js` file contains a `CONFIG` object with:
- Base URL for asset loading (default: './')
- Canvas dimensions (520x398px)
- Card dimensions (40x30px)
- Bowl geometry (center, radius, positions of stick/stone/hole)
- Maximum tableau size (7 items)
- Total cards in deck (42)

### Application State
The application maintains a comprehensive state object that tracks:
- Card positions and rotations
- Tableau list (up to 7 cards)
- Selected and hovered cards/elements
- Image preloading progress
- Game session data and logs
- Lottery mode toggle
- Play/pause status
- Cover visibility state

### Bowl Geometry Reference
```javascript
centerX: 340, centerY: 195, radius: 95
Stick: (400,260) to (420,220)
Stone: (263,137), radius 12
Hole: (370,155), radius 15
```

### Card Object Structure
Each card in the system is represented by a `Card` class with properties:
- `id` - Unique card identifier
- `imageId` - Corresponding image file number (1-42)
- `x, y` - Position coordinates on the canvas
- `angle` - Rotation angle in degrees
- `info` - Bit flags for position information (proximity to stick/stone/hole)
- `message` - Interpretation text loaded from Captions/
- `width, height` - Card dimensions (40x30 pixels)

The Card class includes methods for:
- `getCorners()` - Calculate rotated polygon vertices
- `containsPoint()` - Hit detection for mouse interactions
- `draw()` - Render the card on canvas with proper rotation

### Asset Requirements
- All card images must be numbered sequentially (1-42)
- Two size variants exist for each card: Large (LgGifs) and Medium (MedGifs)
- Caption text files (.txt) contain brief descriptions for each card
- Sound file available in both legacy (.au) and modern (.mp3) formats
- MedGifs includes special helper images: leafblank.gif, leafstack.gif, leafside.gif, leafhole.gif

### File Formats Used
- **Card Images:** GIF format (legacy from 1999, universally supported)
- **Bowl Images:** GIF (legacy spiderbowl2.gif, cover.gif) and JPG (modern NewSpiderBowl variations)
- **Captions:** Plain text files with CR line endings (Mac format from 1999)
- **Sound:** MP3 (modern, 9.7KB) and AU (legacy, 25KB)
- **Code:** HTML5 and ES6 JavaScript (modern standards)

## Running the Application

### Local Development
1. Serve files via HTTP server (required for asset loading)
2. Update `BASE_URL` in `spider.js` if needed
3. Open `index.html` in a modern web browser

### Browser Requirements
- Canvas API support (2D rendering context)
- ES6 JavaScript support (classes, const/let, arrow functions, template literals)
- Audio API for sound effects
- Modern event listeners (addEventListener)

### Browser Compatibility
**Supported:**
- Chrome/Edge 90+ (fully tested)
- Firefox 88+
- Safari 14+
- Opera 76+

**Not Supported:**
- Internet Explorer (no ES6 support)
- Older mobile browsers without Canvas API
- Browsers with JavaScript disabled

## Cultural Context
This application is based on traditional African divination practices, specifically spider divination systems. The referenced text files (`muyandre.txt`, `nggwa.txt`) contain cultural and historical information about these practices.

## Version History
- **1998**: Initial development, cover.gif created
- **1999**: Java applet completed (SpiderV.jar, 109KB)
  - Mac executable released
  - Original audio file (gong.au) added
  - Cultural reference texts (muyandre.txt, nggwa.txt) included
  - All 42 card images and captions finalized
- **2004**: File organization updates (directory timestamps)
- **2026**: Modern JavaScript web implementation
  - Complete rewrite from Java to ES6 JavaScript
  - New high-resolution bowl images created (NewSpiderBowl.jpg variants)
  - MP3 audio format added for modern browsers
  - Canvas-based rendering replacing Java AWT
  - Responsive HTML5 layout with modern styling
  - CLAUDE.md documentation added

## Maintenance Guide

### Adding New Cards
To add cards to the system:
1. Create image files in both LgGifs/ and MedGifs/ directories (leafN.gif format)
2. Create corresponding caption file in Captions/ directory (leafN.txt)
3. Update `CONFIG.TOTAL_CARDS` in spider.js
4. Ensure sequential numbering is maintained

### Troubleshooting
- **Images not loading:** Verify HTTP server is running (cannot use file:// protocol)
- **Sound not playing:** Check browser autoplay policies, gong.mp3 must be loaded
- **Cards not clickable:** Check canvas initialization and event listeners
- **Caption text garbled:** Captions use CR line endings; may need conversion for some editors

### Performance Notes
- All 84 card images (42 × 2 sizes) are preloaded on startup
- Canvas redraw occurs on every mouse move when hovering
- Consider implementing requestAnimationFrame for smoother animations
- Image preloading shows progress in status bar

## Future Considerations
- Responsive design for mobile devices
- Accessibility improvements (ARIA labels, keyboard navigation)
- Progressive image loading or lazy loading for faster startup
- Sound toggle controls
- Save/load divination sessions
- Internationalization support
- Touch gesture support for mobile devices
- Convert GIF images to WebP for better compression
- Implement service worker for offline functionality

## Known Legacy
- Original Java applet files retained for archival purposes
- Original audio format (.au) preserved alongside modern MP3
- Bowl images available in multiple variants for potential UI updates
