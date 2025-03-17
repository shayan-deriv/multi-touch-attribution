# User Journey Tracker

A lightweight library to track user pageviews before signup, allowing you to understand the user's journey through your website.

## Installation

```bash
npm install user-journey-tracker
# or
yarn add user-journey-tracker
```

## Basic Usage

```javascript
// Import the default singleton instance
import userJourneyTracker from 'user-journey-tracker';

// Initialize the tracker
userJourneyTracker.init();

// When user signs up, get their journey
function onUserSignup(userId) {
  const journeyEvents = userJourneyTracker.getEvents();

  // Send to your backend
  fetch('/api/user-journey', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId,
      events: journeyEvents
    })
  });

  // Clear the events after sending
  userJourneyTracker.clearEvents();
}
```

## Usage with Different Frameworks

UserJourneyTracker is framework-agnostic and works with any JavaScript application. Here are examples for common frameworks:

### Vanilla JavaScript

```html
<script src="user-journey-tracker.js"></script>
<script>
  // Initialize with auto-tracking
  var tracker = new UserJourneyTracker({ autoTracking: true });
  tracker.init();

  // For manual tracking of specific events
  document.getElementById('signup-button').addEventListener('click', function() {
    // Later when user completes signup
    tracker.recordSignup('user123');
  });
</script>
```

### React

```jsx
import { useEffect } from 'react';
import { UserJourneyTracker } from 'user-journey-tracker';

function App() {
  useEffect(() => {
    // Create and initialize the tracker
    const tracker = new UserJourneyTracker({ autoTracking: true });
    tracker.init();

    // Store for later use if needed
    window.journeyTracker = tracker;
  }, []);

  return (
    // Your app
  );
}
```

### Vue.js

```javascript
// In your main.js or App.vue
import { UserJourneyTracker } from 'user-journey-tracker';

// Create in main.js
const tracker = new UserJourneyTracker({ autoTracking: true });
tracker.init();

// Make available globally
Vue.prototype.$journeyTracker = tracker;

// In Vue 3, use app.config.globalProperties
// app.config.globalProperties.$journeyTracker = tracker;
```

### Angular

```typescript
// In your app.component.ts
import { Component, OnInit } from '@angular/core';
import { UserJourneyTracker } from 'user-journey-tracker';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  ngOnInit() {
    const tracker = new UserJourneyTracker({ autoTracking: true });
    tracker.init();

    // Store for services to use
    (window as any).journeyTracker = tracker;
  }
}
```

### Testing with Different URL Patterns

The library works with any SPA routing pattern:

- Hash-based routing: `example.com/#/products`
- History API routing: `example.com/products`
- Query parameter routing: `example.com/?page=products`

## Example URLs for Testing

Here are various test URLs that cover different attribution scenarios:

### Basic UTM Parameters
```
http://localhost:3000/?utm_source=google&utm_medium=cpc&utm_campaign=spring_sale
```

### Complete UTM Set
```
http://localhost:3000/?utm_source=facebook&utm_medium=social&utm_campaign=summer_promo&utm_term=beach_vacation&utm_content=carousel_ad
```

### Google Ads (Search)
```
http://localhost:3000/?utm_source=google&utm_medium=cpc&utm_campaign=brand_terms&utm_term=your_brand_name&gclid=CjsKDwjw2v6SBhDEARIsAJUXMpmK7M
```

### Facebook Ads
```
http://localhost:3000/?utm_source=facebook&utm_medium=paid_social&utm_campaign=conversion_campaign&fbclid=IwAR12345abcdef
```

### Microsoft/Bing Ads
```
http://localhost:3000/?utm_source=bing&utm_medium=cpc&utm_campaign=competitor_terms&mkclid=123abc456def
```

### Email Marketing
```
http://localhost:3000/?utm_source=mailchimp&utm_medium=email&utm_campaign=weekly_newsletter&utm_content=main_cta
```

### Social Media (Organic)
```
http://localhost:3000/?utm_source=twitter&utm_medium=organic_social&utm_campaign=product_launch
```

### Multiple Ad IDs
```
http://localhost:3000/?utm_source=google&utm_medium=cpc&utm_campaign=performance_max&utm_ad_id=ad123&utm_ad_group_id=group456&utm_campaign_id=camp789&gclid=CjsKDwjw2v6SBhDEARIsAJUXMpmK7M
```

## README.md