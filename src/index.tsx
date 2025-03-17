/**
 * UserJourneyTracker
 * A lightweight library to track user pageviews and attribution data before signup
 * This library implements the attribution tracking plan to capture user journey data
 * across multiple touchpoints before a user signs up or logs in.
 */

/**
 * Interface for storing attribution data from various marketing channels
 * Captures UTM parameters, click IDs, and referrer information
 */
interface AttributionData {
    utm_campaign?: string;    // Marketing campaign name
    utm_medium?: string;      // Marketing medium (e.g., cpc, email, social)
    utm_source?: string;      // Traffic source (e.g., google, facebook)
    utm_term?: string;        // Keywords used in paid search
    utm_ad_id?: string;       // Specific ad identifier
    utm_ad_group_id?: string; // Ad group identifier
    utm_campaign_id?: string; // Campaign identifier
    gclid?: string;           // Google Click ID for AdWords tracking
    fbclid?: string;          // Facebook Click ID for ads tracking
    mkclid?: string;          // Microsoft/Bing Click ID for ads tracking
    referrer?: string;        // The URL from which the user arrived
    landing_page?: string;    // The page user lands on
}

/**
 * Interface for storing page view events with attribution data
 * Each event represents a user visit with its associated attribution information
 */
interface PageViewEvent {
    url: string;              // Full URL of the page visited
    timestamp: number;        // Unix timestamp of the visit
    referrer?: string;        // Referring URL if available
    title?: string;           // Page title if available
    attribution: AttributionData; // Attribution data for this visit
    uuid: string;             // Unique identifier for this browser/device
    is_loggedin: boolean;     // Whether the user was logged in during this visit
    event_id: string;         // Unique identifier for this event
}

/**
 * Configuration options for the UserJourneyTracker
 */
interface UserJourneyTrackerOptions {
    cookieDomain?: string;    // Domain for the cookie (e.g., .example.com for all subdomains)
    cookieExpireDays?: number; // Number of days until cookie expires
    maxEvents?: number;       // Maximum number of events to store
    resetOnLogin?: boolean;   // Whether to reset tracking data when user logs in
    resetOnSignup?: boolean;  // Whether to reset tracking data when user signs up
    autoTrack?: boolean;      // Whether to automatically track page views
    trackHashChange?: boolean; // Whether to track hash changes in SPAs
    trackHistoryChange?: boolean; // Whether to track history API changes in SPAs
}

/**
 * Main class for tracking user journeys across multiple touchpoints
 * Implements the multi-touch attribution model described in the tracking plan
 */
class UserJourneyTracker {
    private options: UserJourneyTrackerOptions;
    private events: PageViewEvent[] = [];  // Array of tracked page view events
    private storageKey: string = 'user_journey_history';  // Fixed storage key
    private cookieName: string = 'user_journey_uuid';     // Fixed cookie name
    private isInitialized: boolean = false; // Flag to prevent multiple initializations
    private uuid: string;                  // Unique identifier for this browser/device
    private derivUserId: string | null = null; // User ID after login/signup
    private isLoggedIn: boolean = false;   // Whether the user is currently logged in
    private oldUuid: string | null = null; // Previous UUID before signup (for cross-device tracking)
    private lastTrackedUrl: string = '';   // Last URL that was tracked
    private currentPageEventId: string | null = null; // ID of the current page event

    /**
     * Constructor - sets up the tracker with default or custom options
     * @param options Configuration options for the tracker
     */
    constructor(options: UserJourneyTrackerOptions = {}) {
        // Merge default options with provided options
        this.options = {
            cookieDomain: this.getTopLevelDomain(),
            cookieExpireDays: 365, // 1 year
            maxEvents: 100,
            resetOnLogin: true,
            resetOnSignup: true,
            autoTrack: true,       // Auto-track by default
            trackHashChange: true, // Track hash changes by default
            trackHistoryChange: true, // Track history changes by default
            ...options
        };

        // Generate or retrieve UUID from cookie
        this.uuid = this.getOrCreateUUID();
    }

    /**
     * Get the top-level domain for cookie sharing across subdomains
     * @returns The top-level domain (e.g., .example.com)
     */
    private getTopLevelDomain(): string {
        if (typeof window === 'undefined') return '';

        const hostParts = window.location.hostname.split('.');
        if (hostParts.length <= 1) return window.location.hostname;

        // Return domain with leading dot for subdomain sharing
        return '.' + hostParts.slice(-2).join('.');
    }

    /**
     * Generate a UUID v4 for uniquely identifying this browser/device or event
     * This is used to track the same user across multiple visits
     * @returns A randomly generated UUID v4 string
     */
    private generateUUID(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Set a cookie with the specified name, value, and expiration
     * @param name Cookie name
     * @param value Cookie value
     * @param days Days until expiration
     */
    private setCookie(name: string, value: string, days: number): void {
        if (typeof window === 'undefined') return;

        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        const expires = "; expires=" + date.toUTCString();
        const domain = this.options.cookieDomain ? `; domain=${this.options.cookieDomain}` : '';
        const path = "; path=/";

        // Add SameSite attribute with fallback for older browsers
        let cookieString = name + "=" + encodeURIComponent(value) + expires + domain + path;

        // Add SameSite=Lax for modern browsers
        cookieString += "; SameSite=Lax";

        // Add Secure flag if on HTTPS
        if (window.location.protocol === 'https:') {
            cookieString += "; Secure";
        }

        document.cookie = cookieString;
    }

    /**
     * Get a cookie value by name
     * @param name Cookie name
     * @returns Cookie value or null if not found
     */
    private getCookie(name: string): string | null {
        if (typeof window === 'undefined') return null;

        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) {
                // Decode the cookie value
                return decodeURIComponent(c.substring(nameEQ.length, c.length));
            }
        }
        return null;
    }

    /**
     * Delete a cookie by name
     * @param name Cookie name
     */
    private deleteCookie(name: string): void {
        if (typeof window === 'undefined') return;

        this.setCookie(name, '', -1);
    }

    /**
     * Get existing UUID from cookie or create a new one if none exists
     * This ensures consistent tracking across page refreshes, sessions, and subdomains
     * @returns The UUID for this browser/device
     */
    private getOrCreateUUID(): string {
        if (typeof window === 'undefined') return this.generateUUID();

        let uuid = this.getCookie(this.cookieName);

        if (!uuid) {
            // First visit - generate and store a new UUID
            uuid = this.generateUUID();
            this.setCookie(
                this.cookieName,
                uuid,
                this.options.cookieExpireDays as number
            );
        }

        return uuid;
    }

    /**
     * Initialize the tracker - load existing events and set up page view tracking
     * This should be called once when the application starts
     * @param isLoggedIn Optional parameter to set initial login state
     * @param userId Optional user ID if already logged in
     */
    public init(isLoggedIn?: boolean, userId?: string): void {
        if (this.isInitialized) return;

        // Set login state if provided
        if (isLoggedIn !== undefined) {
            this.isLoggedIn = isLoggedIn;
        }

        // Set user ID if provided
        if (userId) {
            this.derivUserId = userId;
        } else if (typeof window !== 'undefined') {
            // Try to load user ID from storage
            const storedUserId = localStorage.getItem(`${this.storageKey}_user_id`);
            if (storedUserId) {
                this.derivUserId = storedUserId;
                this.isLoggedIn = true;
            }
        }

        // Load existing events from storage
        this.loadEvents();

        // Set up auto-tracking if enabled
        if (this.options.autoTrack) {
            this.setupAutoTracking();
        }

        this.isInitialized = true;
    }

    /**
     * Set up auto-tracking for page views
     * This adds event listeners for various navigation events in SPAs
     */
    private setupAutoTracking(): void {
        if (typeof window === 'undefined') return;

        // Store initial URL
        this.lastTrackedUrl = window.location.href;

        // Track initial page view
        this.trackCurrentPageView();

        // Track popstate events (browser back/forward buttons)
        window.addEventListener('popstate', () => {
            // Only track if URL has changed
            if (window.location.href !== this.lastTrackedUrl) {
                this.lastTrackedUrl = window.location.href;
                this.trackCurrentPageView();
            }
        });

        // Track hash changes if enabled
        if (this.options.trackHashChange) {
            window.addEventListener('hashchange', () => {
                // Only track if URL has changed
                if (window.location.href !== this.lastTrackedUrl) {
                    this.lastTrackedUrl = window.location.href;
                    this.trackCurrentPageView();
                }
            });
        }

        // Track history API changes if enabled
        if (this.options.trackHistoryChange) {
            // Save original methods
            const originalPushState = history.pushState;
            const originalReplaceState = history.replaceState;

            // Override pushState
            history.pushState = (...args) => {
                // Call original method
                originalPushState.apply(history, args);

                // Track the new state
                if (window.location.href !== this.lastTrackedUrl) {
                    this.lastTrackedUrl = window.location.href;
                    this.trackCurrentPageView();
                }
            };

            // Override replaceState
            history.replaceState = (...args) => {
                // Call original method
                originalReplaceState.apply(history, args);

                // Track the new state
                if (window.location.href !== this.lastTrackedUrl) {
                    this.lastTrackedUrl = window.location.href;
                    this.trackCurrentPageView();
                }
            };
        }
    }

    /**
     * Update the login state and update the most recent page view if needed
     * This should be called after authentication status is determined
     * @param isLoggedIn Whether the user is logged in
     * @param userId The user ID if logged in
     */
    public updateLoginState(isLoggedIn: boolean, userId?: string): void {
        const previousState = this.isLoggedIn;
        this.isLoggedIn = isLoggedIn;

        if (userId) {
            this.derivUserId = userId;

            // Store the user ID for future reference
            if (typeof window !== 'undefined') {
                localStorage.setItem(`${this.storageKey}_user_id`, userId);
            }
        }

        // If we have a current page event ID, update its login state
        if (this.currentPageEventId) {
            this.updateEventLoginState(this.currentPageEventId, isLoggedIn);
        }
    }

    /**
     * Update the login state of a specific event
     * @param eventId The ID of the event to update
     * @param isLoggedIn The new login state
     */
    private updateEventLoginState(eventId: string, isLoggedIn: boolean): void {
        // Find the event with the matching ID
        const eventIndex = this.events.findIndex(event => event.event_id === eventId);

        if (eventIndex !== -1) {
            // Update the login state
            this.events[eventIndex].is_loggedin = isLoggedIn;

            // Save the updated events
            this.saveEvents();
        }
    }

    /**
     * Parse attribution data from the current URL
     * This extracts UTM parameters, click IDs, and referrer information
     * @returns Attribution data object
     */
    private parseAttributionData(): AttributionData {
        if (typeof window === 'undefined') return {};

        const url = new URL(window.location.href);
        const params = url.searchParams;

        const attribution: AttributionData = {};

        // Extract UTM parameters
        const utmParams = [
            'utm_campaign', 'utm_medium', 'utm_source', 'utm_term',
            'utm_ad_id', 'utm_ad_group_id', 'utm_campaign_id'
        ];

        utmParams.forEach(param => {
            const value = params.get(param);
            if (value) {
                attribution[param as keyof AttributionData] = value;
            }
        });

        // Extract click IDs
        const clickIds = ['gclid', 'fbclid', 'mkclid'];
        clickIds.forEach(param => {
            const value = params.get(param);
            if (value) {
                attribution[param as keyof AttributionData] = value;
            }
        });

        // Add referrer if available
        if (document.referrer) {
            try {
                const referrerUrl = new URL(document.referrer);
                // Only store referrer if it's from a different domain
                if (referrerUrl.hostname !== window.location.hostname) {
                    attribution.referrer = document.referrer;
                }
            } catch (e) {
                // Invalid referrer URL, ignore
            }
        }

        // Add landing page
        attribution.landing_page = window.location.pathname;

        return attribution;
    }

    /**
     * Check if this is a new attribution source worth tracking
     * This prevents duplicate entries for the same source
     * @param attribution The attribution data to check
     * @returns True if this is a new attribution source
     */
    private isNewAttributionSource(attribution: AttributionData): boolean {
        // Always track if this is the first event
        if (this.events.length === 0) return true;

        // Get the last event
        const lastEvent = this.events[this.events.length - 1];

        // Always track if URL has changed
        if (lastEvent.url !== window.location.href) return true;

        // Check if this has new attribution data
        const hasNewAttribution = Object.entries(attribution).some(([key, value]) => {
            // Skip referrer and landing_page in comparison
            if (key === 'referrer' || key === 'landing_page') return false;

            // Check if this parameter is new or different
            return value && lastEvent.attribution[key as keyof AttributionData] !== value;
        });

        return hasNewAttribution;
    }

    /**
     * Track the current page view if it has a new attribution source
     * This implements the "Tracking Events for Every User Visit" approach
     */
    private trackCurrentPageView(): void {
        if (typeof window === 'undefined') return;

        // Extract attribution data from the current URL
        const attribution = this.parseAttributionData();

        // Only track if this is a new attribution source
        // This prevents duplicate entries for the same source
        if (this.isNewAttributionSource(attribution)) {
            // Generate a unique ID for this event
            const eventId = this.generateUUID();

            const event: PageViewEvent = {
                url: window.location.href,
                timestamp: Date.now(),
                referrer: document.referrer || undefined,
                title: document.title || undefined,
                attribution: attribution,
                uuid: this.uuid,
                is_loggedin: this.isLoggedIn,
                event_id: eventId
            };

            // Store the current page event ID for potential updates
            this.currentPageEventId = eventId;

            this.addEvent(event);
        }
    }

    /**
     * Add a page view event to history and save to storage
     * @param event The page view event to add
     */
    private addEvent(event: PageViewEvent): void {
        this.events.push(event);

        // Trim events if exceeding max count to prevent storage issues
        if (this.events.length > (this.options.maxEvents as number)) {
            this.events = this.events.slice(this.events.length - (this.options.maxEvents as number));
        }

        // Save updated events to storage
        this.saveEvents();
    }

    /**
     * Save events to browser localStorage
     * Handles storage quota errors by reducing the number of stored events
     */
    private saveEvents(): void {
        if (typeof window === 'undefined') return;

        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.events));
        } catch (e) {
            console.error('Failed to save user journey events:', e);

            // If we hit storage limits, try to reduce the data size
            // This addresses the "Cookie Storage & Size Limits" concern
            if (e instanceof DOMException && (
                e.name === 'QuotaExceededError' ||
                e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {

                // Keep only the most recent events
                if (this.events.length > 10) {
                    this.events = this.events.slice(this.events.length - 10);
                    this.saveEvents();
                }
            }
        }
    }

    /**
     * Load events from browser localStorage
     * This restores the tracking history when the page is reloaded
     */
    private loadEvents(): void {
        if (typeof window === 'undefined') return;

        try {
            const storedEvents = localStorage.getItem(this.storageKey);
            if (storedEvents) {
                this.events = JSON.parse(storedEvents);
            }
        } catch (e) {
            console.error('Failed to load user journey events:', e);
        }
    }

    /**
     * Get all tracked events
     * @returns A copy of the events array to prevent external modification
     */
    public getEvents(): PageViewEvent[] {
        return [...this.events];
    }

    /**
     * Clear all tracked events
     * This is used when resetting tracking after login/signup
     */
    public clearEvents(): void {
        this.events = [];

        if (typeof window !== 'undefined') {
            localStorage.removeItem(this.storageKey);
        }
    }

    /**
     * Track a custom page view (for SPAs that don't trigger page loads)
     * This should be called manually when the route changes in a SPA
     * @param url Optional URL to track (defaults to current URL)
     * @param title Optional page title (defaults to current title)
     */
    public trackPageView(url?: string, title?: string): void {
        if (typeof window === 'undefined') return;

        // Update the URL and title if provided
        if (url) {
            history.pushState({}, title || '', url);
        }

        // Update last tracked URL
        this.lastTrackedUrl = window.location.href;

        // Track the page view with the updated URL
        this.trackCurrentPageView();
    }

    /**
     * Record user login
     * This associates the tracking data with a user ID and optionally resets tracking
     * @param derivUserId The user ID assigned after login
     */
    public recordLogin(derivUserId: string): void {
        this.isLoggedIn = true;
        this.derivUserId = derivUserId;

        // Store the user ID for future reference
        if (typeof window !== 'undefined') {
            localStorage.setItem(`${this.storageKey}_user_id`, derivUserId);
        }

        // Update the current page event if it exists
        if (this.currentPageEventId) {
            this.updateEventLoginState(this.currentPageEventId, true);
        }

        // Reset events if configured to do so
        // This implements the "Reset Cookies on Login" approach
        if (this.options.resetOnLogin) {
            this.clearEvents();
        }
    }

    /**
     * Record user signup
     * This associates the tracking data with a user ID, stores the old UUID,
     * and optionally resets tracking
     * @param derivUserId The user ID assigned after signup
     */
    public recordSignup(derivUserId: string): void {
        // Store the old UUID before potentially resetting
        // This is important for cross-device attribution
        this.oldUuid = this.uuid;

        this.isLoggedIn = true;
        this.derivUserId = derivUserId;

        // Store the user ID and old UUID for future reference
        if (typeof window !== 'undefined') {
            localStorage.setItem(`${this.storageKey}_user_id`, derivUserId);

            // Store the old UUID for reference
            // This helps with "Handling Multi-Touch & Multi-Device Attribution"
            if (this.oldUuid) {
                localStorage.setItem(`${this.storageKey}_old_uuid`, this.oldUuid);
            }
        }

        // Update the current page event if it exists
        if (this.currentPageEventId) {
            this.updateEventLoginState(this.currentPageEventId, true);
        }

        // Reset events if configured to do so
        // This implements the "Reset Cookies on Sign-Up" approach
        if (this.options.resetOnSignup) {
            this.clearEvents();
        }
    }

    /**
     * Export journey data for sending to server
     * This provides all the data needed for backend storage and analysis
     * @returns An object containing UUID, user ID, old UUID, and all tracked events
     */
    public exportJourney(): {
        uuid: string,
        deriv_user_id?: string,
        old_uuid?: string,
        events: PageViewEvent[]
    } {
        return {
            uuid: this.uuid,                       // Current browser/device UUID
            deriv_user_id: this.derivUserId || undefined, // User ID if logged in
            old_uuid: this.oldUuid || undefined,   // Previous UUID if changed
            events: this.getEvents()               // All tracked events
        };
    }
}

// Export as singleton and constructor
// The singleton allows for easy use without creating a new instance
const defaultTracker = new UserJourneyTracker();

export { UserJourneyTracker, defaultTracker };
export default defaultTracker;