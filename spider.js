/**
 * Spider Divination IV - JavaScript Implementation
 * Converted from Java Applet (1998-1999)
 *
 * An interactive divination system based on African spider divination practices.
 */

// Configuration
const CONFIG = {
    BASE_URL: './', // Change this to your HTTP server base URL if needed
    TOTAL_CARDS: 42,
    CANVAS_WIDTH: 520,
    CANVAS_HEIGHT: 398,
    CARD_WIDTH: 40,
    CARD_HEIGHT: 30,
    MAX_TABLEAU_SIZE: 7,
    // Bowl geometry - positions of key elements
    BOWL: {
        centerX: 340,
        centerY: 195,
        radius: 95,
        // Stick position (diagonal line in bowl)
        stick: {
            x1: 400,
            y1: 260,
            x2: 420,
            y2: 220
        },
        // Stone position (small circle)
        stone: {
            x: 263,
            y: 137,
            radius: 12
        },
        // Hole position (dark area)
        hole: {
            x: 370,
            y: 155,
            radius: 15
        }
    }
};

// Application State
const state = {
    cards: [],
    tableau: [],
    selectedCard: null,
    hoveredCard: null,
    hoveredElement: null, // 'stick', 'stone', 'hole', or null
    captions: {},
    cardImages: {},
    largeCardImages: {},
    backgroundImage: null,
    coverImage: null,      // cover.gif - lid that covers the bowl
    leafStackImage: null,  // leafstack.gif - stack of leaves shown in empty bowl
    gongSound: null,       // gong.mp3 - sound played on reset
    showCover: false,      // whether to show the cover over the bowl (starts uncovered)
    showLeafStack: true,   // whether to show the leaf stack in the bowl
    isPlaying: false,
    isPaused: false,
    lotteryMode: false,
    sessionLog: [],
    sessionStartTime: null,
    usedCards: new Set(),
    reservedCardIds: [],   // card IDs placed by handleReset, to be included in generateTableau
    imagesLoaded: 0,
    totalImages: 0
};

// DOM Elements
let canvas, ctx;
let elements = {};

/**
 * Card class - represents a divination card/leaf
 */
class Card {
    constructor(id, imageId, x, y, angle) {
        this.id = id;
        this.imageId = imageId;
        this.x = x;
        this.y = y;
        this.angle = angle; // degrees
        this.info = 0; // bit flags for position info
        this.message = '';
        this.width = CONFIG.CARD_WIDTH;
        this.height = CONFIG.CARD_HEIGHT;
    }

    /**
     * Get the corners of the card as a polygon (for rotation)
     */
    getCorners() {
        const cos = Math.cos(this.angle * Math.PI / 180);
        const sin = Math.sin(this.angle * Math.PI / 180);
        const hw = this.width / 2;
        const hh = this.height / 2;

        const corners = [
            { x: -hw, y: -hh },
            { x: hw, y: -hh },
            { x: hw, y: hh },
            { x: -hw, y: hh }
        ];

        return corners.map(c => ({
            x: this.x + c.x * cos - c.y * sin,
            y: this.y + c.x * sin + c.y * cos
        }));
    }

    /**
     * Check if a point is inside this card
     */
    containsPoint(px, py) {
        const corners = this.getCorners();
        return this.pointInPolygon(px, py, corners);
    }

    /**
     * Point in polygon test using ray casting
     */
    pointInPolygon(x, y, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;

            if (((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }

    /**
     * Calculate the card's pointing direction (tip of the leaf)
     */
    getTipPoint() {
        const cos = Math.cos(this.angle * Math.PI / 180);
        const sin = Math.sin(this.angle * Math.PI / 180);
        // Tip is at the "top" of the card in local coordinates (pointing upward when angle = 0)
        // Card is drawn centered, so tip is at height/2 from center
        // In canvas, Y increases downward, so "up" is negative Y
        return {
            x: this.x + (this.height / 2) * sin,
            y: this.y - (this.height / 2) * cos
        };
    }

    /**
     * Get the pointing line segment from card center through tip, extending 300px
     * Returns {x1, y1, x2, y2} where (x1,y1) is center and (x2,y2) is extended tip
     */
    getPointingLine() {
        const tip = this.getTipPoint();
        const dx = tip.x - this.x;
        const dy = tip.y - this.y;
        const len = Math.sqrt(dx * dx + dy * dy);

        // Normalize and extend to 300px
        const extend = 300;
        const x2 = this.x + (dx / len) * extend;
        const y2 = this.y + (dy / len) * extend;

        return { x1: this.x, y1: this.y, x2: x2, y2: y2 };
    }

    /**
     * Check if a line segment intersects a circle's perimeter (not interior)
     */
    lineIntersectsCirclePerimeter(x1, y1, x2, y2, cx, cy, r) {
        // Calculate the distance from circle center to the line
        const dx = x2 - x1;
        const dy = y2 - y1;
        const fx = x1 - cx;
        const fy = y1 - cy;

        const a = dx * dx + dy * dy;
        const b = 2 * (fx * dx + fy * dy);
        const c = fx * fx + fy * fy - r * r;

        const discriminant = b * b - 4 * a * c;
        if (discriminant < 0) return false;

        const sqrtD = Math.sqrt(discriminant);
        const t1 = (-b - sqrtD) / (2 * a);
        const t2 = (-b + sqrtD) / (2 * a);

        // Check if the line segment touches or crosses the circle perimeter
        return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
    }

    /**
     * Interpret the card's relationship to bowl elements
     */
    interpret() {
        this.info = 0;
        this.message = '';
        const messages = [];

        const corners = this.getCorners();
        const tip = this.getTipPoint();
        const bowl = CONFIG.BOWL;

        // Check if card is over stick
        if (this.lineIntersectsPolygon(bowl.stick.x1, bowl.stick.y1,
                                       bowl.stick.x2, bowl.stick.y2, corners)) {
            this.info |= 1; // over stick
            messages.push('is over stick');
        }

        // Check if card is over stone
        if (this.circleIntersectsPolygon(bowl.stone.x, bowl.stone.y,
                                          bowl.stone.radius, corners)) {
            this.info |= 2; // over stone
            messages.push('is over stone');
        }

        // Check if card is over hole
        if (this.circleIntersectsPolygon(bowl.hole.x, bowl.hole.y,
                                          bowl.hole.radius, corners)) {
            this.info |= 4; // over hole
            messages.push('is over hole');
        }

        // Get the pointing line (from center through tip, extending 300px)
        const pointingLine = this.getPointingLine();

        // Check if card is pointing to stick (pointing line intersects stick)
        if (this.lineIntersectsPolygon(pointingLine.x1, pointingLine.y1,
                                       pointingLine.x2, pointingLine.y2,
                                       [{x: bowl.stick.x1, y: bowl.stick.y1},
                                        {x: bowl.stick.x2, y: bowl.stick.y2}])) {
            this.info |= 8; // pointing to stick
            messages.push('is pointing to stick');
        }

        // Check if card is pointing to stone (pointing line intersects stone perimeter + 20px)
        if (this.lineIntersectsCirclePerimeter(pointingLine.x1, pointingLine.y1,
                                               pointingLine.x2, pointingLine.y2,
                                               bowl.stone.x, bowl.stone.y,
                                               bowl.stone.radius + 20)) {
            this.info |= 16; // pointing to stone
            messages.push('is pointing to stone');
        }

        // Check if card is pointing to hole (pointing line intersects hole perimeter + 20px)
        if (this.lineIntersectsCirclePerimeter(pointingLine.x1, pointingLine.y1,
                                               pointingLine.x2, pointingLine.y2,
                                               bowl.hole.x, bowl.hole.y,
                                               bowl.hole.radius + 20)) {
            this.info |= 32; // pointing to hole
            messages.push('is pointing to hole');
        }

        // Check if card is near stick
        if (this.polygonNearLineButNotIntersecting(corners, bowl.stick.x1, bowl.stick.y1,
                                                    bowl.stick.x2, bowl.stick.y2, 20)) {
            this.info |= 64; // near stick
            messages.push('is near the stick');
        }

        // Check if card is near stone
        if (this.polygonNearCircleButNotIntersecting(corners, bowl.stone.x, bowl.stone.y,
                                                      bowl.stone.radius, 20)) {
            this.info |= 128; // near stone
            messages.push('is near the stone');
        }

        // Check if card is near hole
        if (this.polygonNearCircleButNotIntersecting(corners, bowl.hole.x, bowl.hole.y,
                                                     bowl.hole.radius, 20)) {
            this.info |= 256; // near hole
            messages.push('is near the hole');
        }

        this.message = messages.join(' ');
        return this.info;
    }

    /**
     * Check if line intersects polygon
     */
    lineIntersectsPolygon(x1, y1, x2, y2, polygon) {
        for (let i = 0; i < polygon.length; i++) {
            const j = (i + 1) % polygon.length;
            if (this.linesIntersect(x1, y1, x2, y2,
                                    polygon[i].x, polygon[i].y,
                                    polygon[j].x, polygon[j].y)) {
                return true;
            }
        }
        // Also check if line is inside polygon
        return this.pointInPolygon(x1, y1, polygon) ||
               this.pointInPolygon(x2, y2, polygon);
    }

    /**
     * Check if two line segments intersect
     */
    linesIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
        const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(d) < 0.0001) return false;

        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / d;

        return t >= 0 && t <= 1 && u >= 0 && u <= 1;
    }

    /**
     * Check if circle intersects polygon
     */
    circleIntersectsPolygon(cx, cy, r, polygon) {
        // Check if circle center is inside polygon
        if (this.pointInPolygon(cx, cy, polygon)) return true;

        // Check if any polygon edge intersects circle
        for (let i = 0; i < polygon.length; i++) {
            const j = (i + 1) % polygon.length;
            if (this.lineIntersectsCircle(polygon[i].x, polygon[i].y,
                                          polygon[j].x, polygon[j].y,
                                          cx, cy, r)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if line segment intersects circle
     */
    lineIntersectsCircle(x1, y1, x2, y2, cx, cy, r) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const fx = x1 - cx;
        const fy = y1 - cy;

        const a = dx * dx + dy * dy;
        const b = 2 * (fx * dx + fy * dy);
        const c = fx * fx + fy * fy - r * r;

        const discriminant = b * b - 4 * a * c;
        if (discriminant < 0) return false;

        const sqrtD = Math.sqrt(discriminant);
        const t1 = (-b - sqrtD) / (2 * a);
        const t2 = (-b + sqrtD) / (2 * a);

        return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
    }

    /**
     * Check if point is near a line segment
     */
    pointNearLine(px, py, x1, y1, x2, y2, threshold) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);

        if (len === 0) return this.distance(px, py, x1, y1) < threshold;

        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (len * len)));
        const nearX = x1 + t * dx;
        const nearY = y1 + t * dy;

        return this.distance(px, py, nearX, nearY) < threshold;
    }

    /**
     * Check if point is near a circle
     */
    pointNearCircle(px, py, cx, cy, threshold) {
        return this.distance(px, py, cx, cy) < threshold;
    }

    /**
     * Check if polygon is near a circle but not intersecting it
     * Near means any vertex is within threshold of the circle's edge
     */
    polygonNearCircleButNotIntersecting(polygon, cx, cy, r, threshold) {
        // If intersecting, return false
        if (this.circleIntersectsPolygon(cx, cy, r, polygon)) {
            return false;
        }

        // Check if any vertex is within threshold of the circle's edge
        for (const vertex of polygon) {
            const distToCenter = this.distance(vertex.x, vertex.y, cx, cy);
            const distToEdge = Math.abs(distToCenter - r);
            if (distToEdge <= threshold) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if polygon is near a line segment but not intersecting it
     * Near means any vertex is within threshold of the line
     */
    polygonNearLineButNotIntersecting(polygon, x1, y1, x2, y2, threshold) {
        // If intersecting, return false
        if (this.lineIntersectsPolygon(x1, y1, x2, y2, polygon)) {
            return false;
        }

        // Check if any vertex is within threshold of the line
        for (const vertex of polygon) {
            if (this.pointNearLine(vertex.x, vertex.y, x1, y1, x2, y2, threshold)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Calculate distance between two points
     */
    distance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }

    /**
     * Draw the card on canvas
     */
    draw(ctx, isSelected = false, isHovered = false) {
        const img = state.cardImages[this.imageId];
        if (!img || !img.complete) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle * Math.PI / 180);

        // Draw card image
        ctx.drawImage(img, -this.width / 2, -this.height / 2, this.width, this.height);

        // Draw selection/hover highlight
        if (isSelected || isHovered) {
            ctx.strokeStyle = isSelected ? '#ffff00' : '#ffffff';
            ctx.lineWidth = isSelected ? 3 : 2;
            ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);
        }

        ctx.restore();

        // Draw pointing line for diagnostic purposes (when hovered or selected)
        if (isSelected || isHovered) {
            const line = this.getPointingLine();
            ctx.save();
            ctx.strokeStyle = '#ff0000'; // Red line for visibility
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]); // Dashed line
            ctx.beginPath();
            ctx.moveTo(line.x1, line.y1);
            ctx.lineTo(line.x2, line.y2);
            ctx.stroke();
            ctx.restore();
        }
    }
}

/**
 * Initialize the application
 */
async function init() {
    // Get DOM elements
    canvas = document.getElementById('bowlCanvas');
    ctx = canvas.getContext('2d');

    elements = {
        tableauList: document.getElementById('tableauList'),
        infoPanel: document.getElementById('cardInfo'),
        statusText: document.getElementById('statusText'),
        loadingText: document.getElementById('loadingText'),
        cardModal: document.getElementById('cardModal'),
        modalImage: document.getElementById('modalImage'),
        modalTitle: document.getElementById('modalTitle'),
        modalDescription: document.getElementById('modalDescription'),
        modalPosition: document.getElementById('modalPosition'),
        // Buttons
        resetBtn: document.getElementById('resetBtn'),
        spiderBtn: document.getElementById('spiderBtn'),
        showBtn: document.getElementById('showBtn'),
        reviewBtn: document.getElementById('reviewBtn'),
        pauseBtn: document.getElementById('pauseBtn'),
        stopBtn: document.getElementById('stopBtn'),
        closeModal: document.getElementById('closeModal'),
        // Checkboxes
        lotteryMode: document.getElementById('lotteryMode'),
        playDelay: document.getElementById('playDelay'),
        // Hover preview
        hoverPreview: document.getElementById('hoverPreview'),
        hoverImage: document.getElementById('hoverImage'),
        hoverCaption: document.getElementById('hoverCaption'),
        hoverStatus: document.getElementById('hoverStatus'),
        // Documentation iframe
        docIframe: document.querySelector('.documentation iframe')
    };

    // Set up event listeners
    setupEventListeners();

    // Load resources
    await loadResources();

    // Initial render
    render();

    // Set initial button states
    setButtonState('start');

    // Adjust iframe height on load
    adjustIframeHeight();

    elements.statusText.textContent = 'Ready - Click "Start" to begin';
}

/**
 * Set button states based on workflow phase
 * @param {string} phase - 'start', 'spider', 'show', or 'reset'
 */
function setButtonState(phase) {
    switch (phase) {
        case 'start':
            elements.resetBtn.disabled = false;   // Start button enabled
            elements.spiderBtn.disabled = true;   // Spider button disabled
            elements.showBtn.disabled = true;     // Show button disabled
            break;
        case 'spider':
            elements.resetBtn.disabled = true;    // Start button disabled
            elements.spiderBtn.disabled = false;  // Spider button enabled
            elements.showBtn.disabled = true;     // Show button disabled
            break;
        case 'show':
            elements.resetBtn.disabled = true;    // Start button disabled
            elements.spiderBtn.disabled = true;   // Spider button disabled
            elements.showBtn.disabled = false;    // Show button enabled
            break;
        case 'reset':
            elements.resetBtn.disabled = false;   // Start button enabled
            elements.spiderBtn.disabled = true;   // Spider button disabled
            elements.showBtn.disabled = true;     // Show button disabled
            break;
    }
}

/**
 * Adjust iframe height based on window height
 */
function adjustIframeHeight() {
    if (!elements.docIframe) return;

    const windowHeight = window.innerHeight;
    const appContainer = document.querySelector('.app-container');
    const iframeContainer = document.querySelector('.documentation');

    // Calculate available height for iframe
    // Subtract approximate height of other elements (controls, bowl, info panel, status bar)
    const otherElementsHeight = 650; // Approximate height of other UI elements
    const availableHeight = Math.max(360, windowHeight - otherElementsHeight);

    elements.docIframe.style.height = availableHeight + 'px';
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Canvas events
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('mouseleave', () => {
        state.hoveredCard = null;
        elements.hoverPreview.classList.remove('visible');
        render();
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Button events
    elements.resetBtn.addEventListener('click', handleReset);
    elements.spiderBtn.addEventListener('click', handleSpider);
    elements.showBtn.addEventListener('click', handleShow);
    elements.reviewBtn.addEventListener('click', handleReview);
    elements.pauseBtn.addEventListener('click', handlePause);
    elements.stopBtn.addEventListener('click', handleStop);
    elements.closeModal.addEventListener('click', () => {
        elements.cardModal.classList.remove('visible');
    });

    // Checkbox events
    elements.lotteryMode.addEventListener('change', (e) => {
        state.lotteryMode = e.target.checked;
        if (state.lotteryMode) {
            state.usedCards.clear();
        }
    });

    // Modal close on overlay click
    elements.cardModal.addEventListener('click', (e) => {
        if (e.target === elements.cardModal) {
            elements.cardModal.classList.remove('visible');
        }
    });

    // Window resize - adjust iframe height
    window.addEventListener('resize', adjustIframeHeight);
    adjustIframeHeight(); // Initial adjustment
}

/**
 * Load all images and captions
 */
async function loadResources() {
    elements.loadingText.textContent = 'Loading...';

    // Calculate total images to load
    state.totalImages = 1 + CONFIG.TOTAL_CARDS * 2; // background + med + large cards

    // Load background image
    const bgPromise = loadImage(`${CONFIG.BASE_URL}NewSpiderBowl.jpg`).then(img => {
        state.backgroundImage = img;
        updateLoadingProgress();
    });

    // Load cover image (lid that covers the bowl)
    const coverPromise = loadImage(`${CONFIG.BASE_URL}cover.gif`).then(img => {
        state.coverImage = img;
    }).catch(() => {
        console.warn('Failed to load cover image');
    });

    // Load leaf stack image (shown in empty bowl)
    const leafStackPromise = loadImage(`${CONFIG.BASE_URL}MedGifs/leafstack.gif`).then(img => {
        state.leafStackImage = img;
    }).catch(() => {
        console.warn('Failed to load leaf stack image');
    });

    // Load gong sound
    state.gongSound = new Audio(`${CONFIG.BASE_URL}gong.mp3`);
    state.gongSound.preload = 'auto';

    // Load card images (medium size)
    const medPromises = [];
    for (let i = 1; i <= CONFIG.TOTAL_CARDS; i++) {
        const promise = loadImage(`${CONFIG.BASE_URL}MedGifs/leaf${i}.gif`).then(img => {
            state.cardImages[i] = img;
            updateLoadingProgress();
        }).catch(() => {
            console.warn(`Failed to load medium card image ${i}`);
            updateLoadingProgress();
        });
        medPromises.push(promise);
    }

    // Load large card images
    const lgPromises = [];
    for (let i = 1; i <= CONFIG.TOTAL_CARDS; i++) {
        const promise = loadImage(`${CONFIG.BASE_URL}LgGifs/leaf${i}.gif`).then(img => {
            state.largeCardImages[i] = img;
            updateLoadingProgress();
        }).catch(() => {
            console.warn(`Failed to load large card image ${i}`);
            updateLoadingProgress();
        });
        lgPromises.push(promise);
    }

    // Load captions
    const captionPromises = [];
    for (let i = 1; i <= CONFIG.TOTAL_CARDS; i++) {
        const promise = loadCaption(i).catch(() => {
            console.warn(`Failed to load caption ${i}`);
        });
        captionPromises.push(promise);
    }

    // Wait for essential resources (background, cover, leafstack, and medium cards)
    await bgPromise;
    await coverPromise;
    await leafStackPromise;
    await Promise.all(medPromises);
    await Promise.all(captionPromises);

    // Large images can continue loading in background
    Promise.all(lgPromises);

    elements.loadingText.textContent = '';
}

/**
 * Load a single image
 */
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load ${src}`));
        img.src = src;
    });
}

/**
 * Load a caption file
 */
async function loadCaption(cardNum) {
    try {
        const response = await fetch(`${CONFIG.BASE_URL}Captions/leaf${cardNum}.txt`);
        if (!response.ok) throw new Error('Caption not found');
        const text = await response.text();
        // Parse caption - format is "TitleDescription" or "Title\nDescription"
        const lines = text.split(/[\r\n]+/);
        state.captions[cardNum] = {
            title: lines[0] || `Leaf ${cardNum}`,
            description: lines[1] || lines[0] || ''
        };
    } catch (e) {
        state.captions[cardNum] = {
            title: `Leaf ${cardNum}`,
            description: ''
        };
    }
}

/**
 * Update loading progress indicator
 */
function updateLoadingProgress() {
    state.imagesLoaded++;
    const pct = Math.round((state.imagesLoaded / state.totalImages) * 100);
    elements.loadingText.textContent = `Loading... ${pct}%`;
}

/**
 * Handle mouse movement on canvas
 */
function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check for card hover
    let foundCard = null;
    for (let i = state.tableau.length - 1; i >= 0; i--) {
        if (state.tableau[i].containsPoint(x, y)) {
            foundCard = state.tableau[i];
            break;
        }
    }

    if (foundCard !== state.hoveredCard) {
        state.hoveredCard = foundCard;
        render();

        // Update hover preview
        if (foundCard) {
            const caption = state.captions[foundCard.imageId] || { title: `Leaf ${foundCard.imageId}`, description: '' };
            const lgImg = state.largeCardImages[foundCard.imageId];

            if (lgImg && lgImg.complete) {
                elements.hoverImage.src = lgImg.src;
            }
            elements.hoverCaption.textContent = caption.title + (caption.description ? ': ' + caption.description : '');
            elements.hoverStatus.textContent = foundCard.message || 'No special position';
            elements.hoverPreview.classList.add('visible');
        } else {
            elements.hoverPreview.classList.remove('visible');
        }
    }

    // Check for bowl element hover
    const bowl = CONFIG.BOWL;
    let element = null;

    if (pointNearLine(x, y, bowl.stick.x1, bowl.stick.y1,
                      bowl.stick.x2, bowl.stick.y2, 15)) {
        element = 'stick';
    } else if (distance(x, y, bowl.stone.x, bowl.stone.y) < bowl.stone.radius + 10) {
        element = 'stone';
    } else if (distance(x, y, bowl.hole.x, bowl.hole.y) < bowl.hole.radius + 10) {
        element = 'hole';
    }

    if (element !== state.hoveredElement) {
        state.hoveredElement = element;
        updateStatusForElement(element);
    }

    // Log mouse position for session recording
    logEvent('Point', `${Math.round(x)} ${Math.round(y)}`);
}

/**
 * Handle click on canvas
 */
function handleClick(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check for card click
    for (let i = state.tableau.length - 1; i >= 0; i--) {
        const card = state.tableau[i];
        if (card.containsPoint(x, y)) {
            selectCard(card);
            logEvent('Focus', `${card.id} ${card.imageId}`);
            return;
        }
    }

    // Clicked on bowl element
    if (state.hoveredElement) {
        logEvent('Focus', state.hoveredElement);
    }
}

/**
 * Select a card and show its info
 */
function selectCard(card) {
    state.selectedCard = card;
    card.isChecked = true;  // Mark this card as checked

    // Update info panel
    const caption = state.captions[card.imageId] || { title: `Leaf ${card.imageId}`, description: '' };
    let infoText = `<strong>${caption.title}</strong>`;
    if (card.message) {
        infoText += `<br><em>${card.message}</em>`;
    }
    elements.infoPanel.innerHTML = infoText;

    // Update tableau list to reflect checkbox states
    updateTableauList();

    // Log
    logEvent('Info', `Leaf ${card.id} ${card.imageId}`);

    render();
}

/**
 * Handle Reset button
 */
function handleReset() {
    state.tableau = [];
    state.selectedCard = null;
    state.hoveredCard = null;
    state.reservedCardIds = [];  // Clear reserved card IDs
    state.showCover = false;     // Hide the cover, show the bowl with leaf stack
    state.showLeafStack = true;  // Show the leaf stack

    // Place 2 random leaves overlapping the hole
    const bowl = CONFIG.BOWL;
    const hole = bowl.hole;

    // Generate 2 random unique card IDs
    const cardId1 = Math.floor(Math.random() * CONFIG.TOTAL_CARDS) + 1;
    let cardId2 = Math.floor(Math.random() * CONFIG.TOTAL_CARDS) + 1;
    while (cardId2 === cardId1) {
        cardId2 = Math.floor(Math.random() * CONFIG.TOTAL_CARDS) + 1;
    }

    // Store these IDs so they'll be included in the full tableau later
    state.reservedCardIds = [cardId1, cardId2];

    // Create the 2 cards positioned over the hole (overlapping)
    const card1 = new Card(1, cardId1, hole.x - 15, hole.y - 10, Math.random() * 60 - 30);
    const card2 = new Card(2, cardId2, hole.x + 10, hole.y + 5, Math.random() * 60 - 30);

    card1.interpret();
    card2.interpret();

    state.tableau.push(card1, card2);

    elements.infoPanel.innerHTML = 'Click on a card to see its interpretation.';
    updateTableauList();
    render();
    elements.statusText.textContent = 'Reset - 2 leaves placed over hole';

    // Enable Spider button, disable Start button
    setButtonState('spider');

    logEvent('Reset', '');
}

/**
 * Handle Spider button - generate new tableau
 */
function handleSpider() {
    state.tableau = [];
    state.selectedCard = null;
    state.hoveredCard = null;
    state.usedCards.clear();
    state.sessionLog = [];
    state.sessionStartTime = null;
    state.showCover = true;  // Hide the cover, show the bowl with leaf stack

    // Play the gong sound
/*
    if (state.gongSound) {
        state.gongSound.currentTime = 0;
        state.gongSound.play().catch(e => {
            console.warn('Could not play gong sound:', e);
        });
    }
*/
    elements.infoPanel.innerHTML = 'Click on a card to see its interpretation.';
    updateTableauList();
    render();

    elements.statusText.textContent = 'Spider - Click "Show" to see Spider tableau';

    // Enable Show button, disable Spider button
    setButtonState('show');
}

/**
 * Generate a new tableau (set of cards)
 */
function generateTableau() {
    const bowl = CONFIG.BOWL;
    // Lottery mode: always 6 cards (for lottery numbers), otherwise 4-7 cards
    const numCards = state.lotteryMode ? 6 : ntableau();

    // Play the gong sound
    if (state.gongSound) {
        state.gongSound.currentTime = 0;
        state.gongSound.play().catch(e => {
            console.warn('Could not play gong sound:', e);
        });
    }

    // Hide the cover and leaf stack when generating a tableau
    state.showCover = false;
    state.showLeafStack = false;

    // Start session if not started
    if (!state.sessionStartTime) {
        state.sessionStartTime = Date.now();
        const now = new Date();
        logEvent('Session', `${now.toLocaleDateString()} ${now.toLocaleTimeString()} ${state.sessionStartTime}`);
    }

    // Get reserved card IDs from handleReset (if any)
    const reservedIds = state.reservedCardIds.slice(); // Copy reserved IDs

    // Clear current tableau
    state.tableau = [];
    state.selectedCard = null;

    // Track cards used in this spread to ensure uniqueness
    const usedInThisSpread = new Set();

    // First, add the reserved cards with random positions
    reservedIds.forEach((id, index) => {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * (bowl.radius - 30) + 20;
        const x = bowl.centerX + r * Math.cos(angle);
        const y = bowl.centerY + r * Math.sin(angle);
        const rotation = Math.floor(Math.random() * 360);

        const card = new Card(index + 1, id, x, y, rotation);
        card.interpret();
        state.tableau.push(card);
        usedInThisSpread.add(id);
    });

    // Then fill the rest with random cards
    const cardsToAdd = numCards - state.tableau.length;

    for (let i = 0; i < cardsToAdd; i++) {
        let imageId;

        if (state.lotteryMode) {
            // Lottery mode: don't repeat cards across spreads
            const available = [];
            for (let j = 1; j <= CONFIG.TOTAL_CARDS; j++) {
                if (!state.usedCards.has(j) && !usedInThisSpread.has(j)) {
                    available.push(j);
                }
            }
            if (available.length === 0) {
                state.usedCards.clear();
                for (let j = 1; j <= CONFIG.TOTAL_CARDS; j++) {
                    if (!usedInThisSpread.has(j)) {
                        available.push(j);
                    }
                }
            }
            imageId = available[Math.floor(Math.random() * available.length)];
            state.usedCards.add(imageId);
        } else {
            // Normal mode: ensure uniqueness within this spread only
            const available = [];
            for (let j = 1; j <= CONFIG.TOTAL_CARDS; j++) {
                if (!usedInThisSpread.has(j)) {
                    available.push(j);
                }
            }
            imageId = available[Math.floor(Math.random() * available.length)];
        }

        usedInThisSpread.add(imageId);

        // Random position within bowl
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * (bowl.radius - 30) + 20;
        const x = bowl.centerX + r * Math.cos(angle);
        const y = bowl.centerY + r * Math.sin(angle);

        // Random rotation (full 360 degrees)
        const rotation = Math.floor(Math.random() * 360);

        const card = new Card(state.tableau.length + 1, imageId, x, y, rotation);
        card.interpret();
        state.tableau.push(card);
    }

    // Clear reserved cards since they're now part of the full tableau
    state.reservedCardIds = [];

    // Log tableau
    logEvent('Tableau', `${state.tableau.length} ${state.tableau.length}`);
    state.tableau.forEach(card => {
        logEvent('Card', `${card.id} ${card.imageId} ${Math.round(card.x)} ${Math.round(card.y)} ${card.angle} ${card.info} ${card.message}`);
    });

    updateTableauList();
    render();

    elements.statusText.textContent = `Generated ${numCards} cards - click on a card to see its meaning`;
}

/**
 * Handle Show button - show selected card in modal
 */
function handleShow() {
	generateTableau();

    if (!state.selectedCard) {
        elements.statusText.textContent = 'Select a card first';
    } else {
        showCardModal(state.selectedCard);
        logEvent('Show', '');
    }

    // Enable Start button, disable Show button
    setButtonState('start');
}

/**
 * Show card in modal dialog
 */
function showCardModal(card) {
    const caption = state.captions[card.imageId] || { title: `Leaf ${card.imageId}`, description: '' };
    const lgImg = state.largeCardImages[card.imageId];

    if (lgImg && lgImg.complete) {
        elements.modalImage.src = lgImg.src;
    } else {
        elements.modalImage.src = state.cardImages[card.imageId]?.src || '';
    }

    elements.modalTitle.textContent = caption.title;
    elements.modalDescription.textContent = caption.description;
    elements.modalPosition.textContent = card.message || 'No special position';

    elements.cardModal.classList.add('visible');
}

/**
 * Handle Review button - placeholder for session playback
 */
function handleReview() {
    elements.statusText.textContent = 'Review feature - session playback (not implemented)';
}

/**
 * Handle Pause button
 */
function handlePause() {
    state.isPaused = !state.isPaused;
    elements.pauseBtn.textContent = state.isPaused ? 'Play' : 'Pause';
}

/**
 * Handle Stop button
 */
function handleStop() {
    state.isPlaying = false;
    state.isPaused = false;
    elements.pauseBtn.textContent = 'Pause';
}

/**
 * Update the tableau list in the side panel
 */
function updateTableauList() {
    elements.tableauList.innerHTML = '';

    state.tableau.forEach((card, index) => {
        const caption = state.captions[card.imageId] || { title: `Leaf ${card.imageId}` };
        const div = document.createElement('div');
        div.className = 'tableau-item' + (card === state.selectedCard ? ' selected' : '');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = card.isChecked || false;
        checkbox.addEventListener('change', (e) => {
            card.isChecked = e.target.checked;
            if (e.target.checked) {
                // This becomes the highlighted card
                selectCard(card);
            } else if (card === state.selectedCard) {
                // Unchecking the currently highlighted card - remove highlight
                state.selectedCard = null;
                elements.infoPanel.innerHTML = 'Click on a card to see its interpretation.';
                render();
            }
        });

        const label = document.createElement('span');
        label.textContent = `${card.imageId}. ${caption.title}`;

        div.appendChild(checkbox);
        div.appendChild(label);
        // Clicking the label/row toggles the checkbox
        label.addEventListener('click', (e) => {
            e.stopPropagation();
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
        });

        elements.tableauList.appendChild(div);
    });
}

/**
 * Update status bar for bowl element hover
 */
function updateStatusForElement(element) {
    if (element) {
        elements.statusText.textContent = `Hovering over: ${element}`;
    } else if (state.hoveredCard) {
        const caption = state.captions[state.hoveredCard.imageId] || { title: `Leaf ${state.hoveredCard.imageId}` };
        elements.statusText.textContent = `Card: ${caption.title}`;
    } else {
        elements.statusText.textContent = 'Ready';
    }
}

/**
 * Main render function
 */
function render() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    if (state.backgroundImage && state.backgroundImage.complete) {
        ctx.drawImage(state.backgroundImage, 0, 0, canvas.width, canvas.height);
    } else {
        // Fallback: draw bowl shape
        drawFallbackBowl();
    }

    // Draw the cover over the bowl if showCover is true
    if (state.showCover && state.coverImage && state.coverImage.complete) {
        drawCover();
    } else {
        // Draw leaf stack when showLeafStack is true
        if (state.showLeafStack && state.leafStackImage && state.leafStackImage.complete) {
            drawLeafStack();
        }

        // Draw bowl element highlights if hovered (only when cover is not shown)
        if (state.hoveredElement) {
            drawElementHighlight(state.hoveredElement);
        }

        // Draw cards
        state.tableau.forEach(card => {
            card.draw(ctx, card === state.selectedCard, card === state.hoveredCard);
        });
    }
}

/**
 * Draw the cover image over the bowl area
 */
function drawCover() {
    const bowl = CONFIG.BOWL;
    const img = state.coverImage;

    // The cover image is circular, draw it centered on the bowl
    // Scale it to 140% of bowl diameter, shifted up 20px and left 20px
    const diameter = bowl.radius * 2 * 1.4;  // 40% larger
    const x = bowl.centerX - (diameter / 2) - 20;  // 20px left
    const y = bowl.centerY - (diameter / 2) - 20;  // 20px up

    ctx.drawImage(img, x, y, diameter, diameter);
}

/**
 * Draw the leaf stack image at the bottom of the bowl
 */
function drawLeafStack() {
    const bowl = CONFIG.BOWL;
    const img = state.leafStackImage;

    // Draw the leaf stack near the bottom of the bowl
    // Position it at the bottom center of the bowl area, then move diagonally -45 degrees
    const width = 80;  // approximate width for the leaf stack
    const height = 60; // approximate height for the leaf stack
    const offset = 70; // diagonal offset in pixels
    const offsetX = -offset * Math.cos(45 * Math.PI / 180); // -45 deg: move left
    const offsetY = -offset * Math.sin(45 * Math.PI / 180); // -45 deg: move up
    const x = bowl.centerX + offsetX;
    const y = bowl.centerY + bowl.radius - 10 + offsetY; // Near bottom of bowl, 10px from edge

    // Save the current context state
    ctx.save();

    // Move to the position where we want to draw
    ctx.translate(x, y);

    // Rotate 45 degrees to the right (clockwise)
    ctx.rotate(45 * Math.PI / 180);

    // Draw the image centered on the translated point
    ctx.drawImage(img, -width / 2, -height / 2, width, height);

    // Restore the context state
    ctx.restore();
}

/**
 * Draw fallback bowl if background image not loaded
 */
function drawFallbackBowl() {
    const bowl = CONFIG.BOWL;

    // Bowl background
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Bowl circle
    ctx.beginPath();
    ctx.arc(bowl.centerX, bowl.centerY, bowl.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#654321';
    ctx.fill();
    ctx.strokeStyle = '#3d2817';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Stone
    ctx.beginPath();
    ctx.arc(bowl.stone.x, bowl.stone.y, bowl.stone.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#888888';
    ctx.fill();

    // Hole
    ctx.beginPath();
    ctx.arc(bowl.hole.x, bowl.hole.y, bowl.hole.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#1a0a00';
    ctx.fill();

    // Stick
    ctx.beginPath();
    ctx.moveTo(bowl.stick.x1, bowl.stick.y1);
    ctx.lineTo(bowl.stick.x2, bowl.stick.y2);
    ctx.strokeStyle = '#d2b48c';
    ctx.lineWidth = 4;
    ctx.stroke();
}

/**
 * Draw highlight around bowl element
 */
function drawElementHighlight(element) {
    const bowl = CONFIG.BOWL;
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
    ctx.lineWidth = 3;

    switch (element) {
        case 'stick':
            ctx.beginPath();
            ctx.moveTo(bowl.stick.x1, bowl.stick.y1);
            ctx.lineTo(bowl.stick.x2, bowl.stick.y2);
            ctx.stroke();
            break;
        case 'stone':
            ctx.beginPath();
            ctx.arc(bowl.stone.x, bowl.stone.y, bowl.stone.radius + 5, 0, Math.PI * 2);
            ctx.stroke();
            break;
        case 'hole':
            ctx.beginPath();
            ctx.arc(bowl.hole.x, bowl.hole.y, bowl.hole.radius + 5, 0, Math.PI * 2);
            ctx.stroke();
            break;
    }
}

/**
 * Log an event for session recording
 */
function logEvent(type, data) {
    if (!state.sessionStartTime) return;

    const timestamp = Date.now() - state.sessionStartTime;
    state.sessionLog.push({ timestamp, type, data });
}

// Utility functions
function distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/**
 * ntableau - Weighted random tableau size selector
 * Returns a random tableau size based on weighted probability distribution:
 * - 10% chance: 2 cards
 * - 60% chance: 4 cards
 * - 15% chance: 5 cards
 * - 10% chance: 6 cards
 * - 5% chance: 7 cards
 * @returns {number} The tableau size (2, 4, 5, 6, or 7)
 */
function ntableau() {
    // 2D array: [cumulative_probability, tableau_size]
    const distribution = [
        [0.1, 2],
        [0.25, 3],
        [0.75, 4],
        [0.9, 5],
        [0.97, 6],
        [1.0, 7]
    ];

    // Generate random value between 0 and 1
    const rand = Math.random();

    // Find first element where cumulative probability >= random value
    for (let i = 0; i < distribution.length; i++) {
        if (rand <= distribution[i][0]) {
            return distribution[i][1];
        }
    }

    // Fallback (should never reach here since last value is 1.0)
    return 7;
}

function pointNearLine(px, py, x1, y1, x2, y2, threshold) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len === 0) return distance(px, py, x1, y1) < threshold;

    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (len * len)));
    const nearX = x1 + t * dx;
    const nearY = y1 + t * dy;

    return distance(px, py, nearX, nearY) < threshold;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
