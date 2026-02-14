/**
 * Valentine's Anti-Gravity Physics Engine
 */

class PhysicsObject {
    constructor(x, y, char, type = 'floating') {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.originX = x;
        this.originY = y;
        this.rotation = Math.random() * 360;
        this.vr = (Math.random() - 0.5) * 2;
        this.type = type; // 'floating', 'text', 'special'
        this.char = char;
        this.element = null; // Set in subclass or below
        this.isFree = type !== 'text'; // Text starts fixed
        this.friction = 0.96;

        // Initialize DOM if not special (SpecialHeart handles its own DOM)
        if (type !== 'special') {
            this.element = this.createDOM();
        }
    }

    createDOM() {
        const el = document.createElement('div');
        el.textContent = this.char;
        el.className = this.type === 'floating' ? 'floating-element' : 'text-particle';

        if (this.type === 'floating') {
            const size = Math.random() * 20 + 20;
            el.style.fontSize = `${size}px`;
            el.style.opacity = Math.random() * 0.5 + 0.5;
        } else {
            el.style.position = 'absolute';
            el.style.display = 'inline-block';
            el.style.whiteSpace = 'pre';
            el.style.fontWeight = 'bold';
            el.style.color = '#e91e63';
            el.style.fontSize = '4rem';
            el.style.cursor = 'default';
        }

        document.body.appendChild(el);
        return el;
    }

    update(mouseX, mouseY, width, height, isHomePage) {
        // Interaction Physics (Repel)
        const dx = this.x - mouseX;
        const dy = this.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const forceRadius = 150;

        // Skip interaction for special hearts (they just float)
        // Also skip ALL interaction if not on home page
        if (isHomePage && dist < forceRadius && this.type !== 'special') {
            const angle = Math.atan2(dy, dx);
            const force = (forceRadius - dist) / forceRadius;
            let push = 15;
            if (this.type === 'text' && !this.isFree) push = 2;
            if (this.type === 'special') push = 3; // Playful but catchable

            this.vx += Math.cos(angle) * force * push;
            this.vy += Math.sin(angle) * force * push;

            if (this.type === 'text' && !this.isFree) {
                this.isFree = true;
            }
        }

        if (this.isFree) {
            // Anti-gravity (float up)
            // Special hearts float slower
            const gravity = this.type === 'special' ? 0.02 : 0.05;
            this.vy -= gravity;

            // Apply Velocity
            this.x += this.vx;
            this.y += this.vy;
            this.rotation += this.vr;

            // Friction
            this.vx *= this.friction;
            this.vy *= this.friction;

            // Screen wrapping / resetting
            if (this.type === 'floating' || this.type === 'special') {
                if (this.y < -50) {
                    this.y = height + 20; // Reappear just below screen
                    this.x = Math.random() * width;
                    this.vy = -Math.random() * 2 - 2; // Initial boost
                    // Reset velocity for special hearts so they don't get too crazy
                    if (this.type === 'special') {
                        this.vx = (Math.random() - 0.5);
                        this.vr = (Math.random() - 0.5);
                        this.vy = -2 - Math.random(); // Ensure special hearts keep moving
                    }
                }
            } else {
                if (this.x < 0 || this.x > width) this.vx *= -1;
                if (this.y < -100) this.y = height + 100;
            }

        }

        // Update DOM
        if (this.element) {
            this.element.style.transform = `translate3d(${this.x}px, ${this.y}px, 0) rotate(${this.rotation}deg)`;
        }
    }
}

class SpecialHeart extends PhysicsObject {
    constructor(x, y, label, url) {
        super(x, y, '❤️', 'special');
        this.label = label;
        this.url = url;
        this.element = this.createSpecialDOM();
        this.vr = (Math.random() - 0.5) * 0.5; // Slower rotation
    }

    createSpecialDOM() {
        const container = document.createElement('div');
        container.className = 'special-heart';

        // Heart icon
        const icon = document.createElement('div');
        icon.textContent = '❤️'; // Or use different colored hearts?
        icon.style.fontSize = '60px';
        container.appendChild(icon);

        // Label
        const labelEl = document.createElement('div');
        labelEl.className = 'heart-label';
        labelEl.textContent = this.label;
        container.appendChild(labelEl);

        // Click event
        container.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent other interactions?
            window.location.href = this.url;
        });

        document.body.appendChild(container); // Append to body directly
        return container;
    }
}

class PhysicsEngine {
    constructor() {
        this.elements = [];
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.mouseX = -1000;
        this.mouseY = -1000;

        this.init();
        this.animate();
    }

    init() {
        this.isHomePage = document.body.classList.contains('home-page');

        window.addEventListener('resize', () => this.handleResize());
        window.addEventListener('mousemove', (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
            if (this.isHomePage) {
                this.spawnTrail(e.clientX, e.clientY);
            }
        });

        // Save state before navigating away
        window.addEventListener('beforeunload', () => this.saveState());

        // Try to load state
        const loaded = this.loadState();

        if (!loaded) {
            // 1. Spawn background floating elements
            this.spawnFloatingElements(20);
        }

        // Logic for Home Page ONLY
        if (this.isHomePage) {
            // Ensure special hearts exist (if we loaded state from a subpage, they might be missing)
            const hasSpecial = this.elements.some(el => el.type === 'special');
            if (!hasSpecial) {
                this.spawnSpecialHearts();
            }
        } else {
            // Logic for Sub Pages
            // Remove any special hearts if they were loaded from state
            this.elements = this.elements.filter(el => {
                if (el.type === 'special') {
                    if (el.el) el.el.remove(); // Remove from DOM
                    return false;
                }
                return true;
            });
        }
    }

    saveState() {
        const state = this.elements.map(el => ({
            x: el.x,
            y: el.y,
            vx: el.vx,
            vy: el.vy,
            rotation: el.rotation,
            vr: el.vr,
            type: el.type,
            char: el.char,
            // special props
            label: el.label || null,
            url: el.url || null
        }));
        sessionStorage.setItem('valentines_state', JSON.stringify(state));
    }

    loadState() {
        const saved = sessionStorage.getItem('valentines_state');
        if (!saved) return false;

        try {
            const state = JSON.parse(saved);
            this.elements = state.map(data => {
                let obj;
                if (data.type === 'special') {
                    obj = new SpecialHeart(data.x, data.y, data.label, data.url);
                } else {
                    obj = new PhysicsObject(data.x, data.y, data.char, data.type);
                }
                // Restore props
                obj.vx = data.vx;
                obj.vy = data.vy;
                obj.rotation = data.rotation;
                obj.vr = data.vr;
                return obj;
            });
            return true;
        } catch (e) {
            console.error("Failed to load state", e);
            return false;
        }
    }

    spawnFloatingElements(count) {
        const shapes = ['❤️', '🌹', '🌸', '✨', '💖', '💌'];
        for (let i = 0; i < count; i++) {
            const x = Math.random() * this.width;
            const y = this.height + Math.random() * 500;
            const char = shapes[Math.floor(Math.random() * shapes.length)];
            const obj = new PhysicsObject(x, y, char, 'floating');
            this.elements.push(obj);
        }
    }

    spawnSpecialHearts() {
        const hearts = [
            { label: 'My Letter', url: 'letter.html' },
            { label: 'Photos', url: 'photos.html' },
            { label: 'Song', url: 'playlist.html' },
            { label: 'My Question to You', url: 'question.html' }
        ];

        hearts.forEach((h, index) => {
            // Spread them out initially
            const x = (this.width / 4) * index + (this.width / 8);
            const y = this.height + Math.random() * 200; // Start below screen

            const heartObj = new SpecialHeart(x, y, h.label, h.url);

            // Give them slightly different initial velocities to mix them up but keep them floaty
            heartObj.vx = (Math.random() - 0.5) * 0.5;
            heartObj.vy = -1 - Math.random(); // Ensure they move up

            this.elements.push(heartObj);
        });
    }

    convertTitleToPhysics() {
        const title = document.getElementById('main-title');
        if (!title) return; // Safety check
        const text = title.textContent;
        // ... (unchanged logic mostly)
        // Since we removed title interaction for simplicity in previous logic, let's keep it robust.

        const rect = title.getBoundingClientRect();

        title.style.visibility = 'hidden';
        title.style.display = 'none'; // we replace it entirely

        // Approximate position since title is centered. 
        // We'll just distribute particles across center screen.
        const startX = (this.width / 2) - (text.length * 20); // rough centering
        const startY = this.height / 2 - 50;

        for (let i = 0; i < text.length; i++) {
            const x = startX + (i * 40);
            const y = startY;
            const obj = new PhysicsObject(x, y, text[i], 'text');
            obj.isFree = false;
            this.elements.push(obj);
        }
    }

    spawnTrail(x, y) {
        if (Math.random() > 0.7) {
            const char = '✨';
            const particle = new PhysicsObject(x, y, char, 'floating');
            particle.element.style.fontSize = '10px';
            particle.element.style.pointerEvents = 'none';
            particle.vy = -1;
            particle.isFree = true;

            setTimeout(() => {
                particle.element.remove();
                this.elements = this.elements.filter(e => e !== particle);
            }, 1000);

            this.elements.push(particle);
        }
    }

    handleResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
    }

    animate() {
        this.elements.forEach(el => el.update(this.mouseX, this.mouseY, this.width, this.height, this.isHomePage));
        requestAnimationFrame(() => this.animate());
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        new PhysicsEngine();
    }, 500);
});
