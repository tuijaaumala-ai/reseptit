# 🍳 Recipe Archive & Shared Shopping List

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Active-brightgreen?style=flat-square&logo=github)](https://tuijaaumala-ai.github.io/reseptit/)
[![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20Mobile%20%7C%20Tablet-blue?style=flat-square)](#)
[![Stack](https://img.shields.io/badge/Stack-HTML5%20%7C%20CSS3%20%7C%20JS%20(ES6)-orange?style=flat-square)](#)
[![Database](https://img.shields.io/badge/Database-kvdb.io%20(Serverless)-purple?style=flat-square)](https://kvdb.io/)

A premium, lightweight, and responsive serverless web application designed to browse recipes, manage pantry checklist states, and collaborate on a real-time synchronized family shopping list.

Built using standard web technologies (HTML5, Vanilla CSS3, and ES6 JavaScript), this application is designed to be hosted 100% free on **GitHub Pages** while relying on localized storage and anonymous cloud databases.

---

## 📖 Table of Contents

1. [🍳 Features](#-features)
   - [Recipe Browser & Search](#1-recipe-browser--search)
   - [Custom Recipe Creator](#2-custom-recipe-creator)
   - [Real-Time Shared Shopping List](#3-real-time-shared-shopping-list)
   - [Grocery Store Mode ("Ostosmoodi")](#4-grocery-store-mode-ostosmoodi)
2. [📁 Project Structure](#-project-structure)
3. [🛠️ Technology Stack](#%EF%B8%8F-technology-stack)
4. [🐍 Python Utility](#-python-utility)
   - [Recipe Compilation (`compile_recipes.py`)](#recipe-compilation-compile_recipespy)
5. [🚀 Getting Started & Configuration](#-getting-started--configuration)
   - [Local Development](#local-development)
   - [Deploying to GitHub Pages](#deploying-to-github-pages)
   - [Setting Up a Private Cloud Sync Bucket](#setting-up-a-private-cloud-sync-bucket)
6. [🔒 Enterprise Sync Optimizations & Security](#-enterprise-sync-optimizations--security)
7. [📄 License](#-license)

---

## 🍳 Features

### 1. Recipe Browser & Search
* **Interactive Catalog:** Fast, client-side fuzzy searching by recipe titles, descriptions, or specific ingredients.
* **Premium Typographic Layout:** Curated layout utilizing Google Fonts (*Outfit* & *Playfair Display*), harmonized HSL color palettes, elegant glassmorphism accents, and automatic Dark/Light mode adaptation.
* **Cooking Checklist (Pantry Mode) with Mutual Exclusion:** Interactive checkboxes next to each recipe ingredient. Ticking off an item marks it as "prepared" or "available in pantry" (crossing it out visually in the recipe view) and dynamically disables its `🛒` button. Conversely, if an item is already on the shopping list, its checkbox is locked and disabled to prevent check-off conflicts.
* **Granular "Add to List" Operations:** Add individual ingredients to your shopping list with a single click of the `🛒` icon (which then locks the checkbox and turns the icon to `✅`). Alternatively, add *only* missing/unprepared ingredients at once using the prominent `🛒 Lisää kaikki` (Add All) action, which intelligently skips items you already marked as available in your pantry.

### 2. Custom Recipe Creator
* **In-App Creation Modal:** Easily add your own custom recipes with titles, descriptions, dynamic ingredient builders (quantity + name rows), and step-by-step instructions.
* **Zero-Database Local Persistence:** All custom recipes are saved to the browser's `localStorage` (`recipes_custom`) and seamlessly prepended to the built-in recipe archive.
* **Management & Deletion:** Delete custom recipes securely with a dedicated button that is only rendered on user-created recipes.

### 3. Real-Time Shared Shopping List
* **Anonymous Cloud Synchronization:** Synchronizes lists across multiple mobile phones, tablets, and computers in real time using a serverless key-value store (`kvdb.io`).
* **Easy Peer Pairing:** Connect devices by generating a random 8-character sync code (e.g. `A1B2C3D4`) on one device and clicking `Liity listalle` (Join list) on another.
* **Instant Cloud Syncing:** Live item checking/unchecking, text edits, additions, and deletions are broadcast to all connected devices instantly.

### 4. Grocery Store Mode ("Ostosmoodi")
* **Mobile-Optimized Widget View:** A dedicated, simplified widget view optimized for mobile phone usage while walking through grocery aisles. Hides recipe selectors, header banners, and editing controls, centering list items and allowing checking off bought items with a single tap.
* **One-Click Navigation:** Jump instantly into the grocery store widget mode, and return to the full recipe browser just as easily with the `🍳 Palaa sovellukseen` (Return to Application) button.

---

## 📁 Project Structure

```text
├── html/                     # Raw individual recipe HTML/HTM source files
├── index.html                # Main application entrance and markup
├── index.css                 # Advanced, fully responsive CSS styling system
├── app.js                    # Core application logic, database sync, and state management
├── recipes.js                # Compiled static recipe database (injected to window.RECIPES)
├── compile_recipes.py        # Python script to compile html/ recipe files into recipes.js
├── .gitignore                # standard git ignore file
└── README.md                 # Project documentation (this file)
```

---

## 🛠️ Technology Stack

* **Structure:** HTML5 Semantic Markup (built for cross-device accessibility and SEO optimization).
* **Presentation:** Pure Vanilla CSS3 (curated HSL variables, fluid layout, smooth transition micro-animations, glassmorphism card styles, responsive Flexbox/Grid, and mobile-first media queries).
* **Logic:** Vanilla JavaScript (ES6+, DOM Events, Fetch API, LocalStorage, Page Visibility API, regex validation).
* **Cloud Database:** Anonymous key-value database hosted at `kvdb.io`.

---

## 🐍 Python Utility

The repository includes a utility script to parse local recipe files and automate catalog compiles.

### Recipe Compilation (`compile_recipes.py`)
This script crawls the `/html` directory, parses all individual recipe HTML pages, extracts titles, descriptions, structured ingredient lists (amount + name), and instructions, and compiles them into a single high-performance static JavaScript bundle (`recipes.js`).

**To run the compiler:**
1. Place any new recipe `.html` or `.htm` files inside the `html/` directory.
2. Run the script:
   ```bash
   python compile_recipes.py
   ```
3. The script will automatically parse the layout structure, create `recipes.js`, and update the static database.

---

## 🚀 Getting Started & Configuration

### Local Development
Since this is a client-side static web application, no complex build system or compilation is required to run it:
1. Clone this repository to your machine.
2. Open `index.html` directly in your browser, or serve it using an extension like VS Code's *Live Server* or a command line utility (e.g. `npx serve .`).
3. Make changes to `index.css` or `app.js` and see updates immediately.

### Deploying to GitHub Pages
To host your custom recipe archive online for free:
1. Push this repository to your GitHub account.
2. Navigate to your repository dashboard on GitHub and go to **Settings** -> **Pages**.
3. Under **Build and deployment**, set the source to `Deploy from a branch` and select the `main` branch.
4. Click save. Your application will be live at `https://<your-username>.github.io/<repository-name>/` within minutes!

### Setting Up a Private Cloud Sync Bucket
By default, the application runs on a shared public fallback bucket. To guarantee 100% reliable syncing and prevent external rate-limit exhaustion:
1. Go to **[kvdb.io](https://kvdb.io/)** and register for a free account.
2. Verify your email address (required to authorize bucket writes).
3. Create a new bucket in your dashboard and copy the 20-character **Bucket ID**.
4. Open [app.js](file:///c:/Users/tuija/code/reseptit/app.js) and update the `bucketId` assignment near the top:
   ```javascript
   const bucketId = (
       window.location.hostname.includes('your-github-username.github.io') || 
       window.location.hostname === 'localhost' || 
       window.location.hostname === '127.0.0.1' ||
       window.location.protocol === 'file:' ||
       /^(192\.168\.|10\.|172\.)/.test(window.location.hostname)
   ) ? 'YOUR_PRIVATE_BUCKET_ID' : 'PUBLIC_FALLBACK_BUCKET_ID';
   ```
5. Commit and push the changes.

---

## 🔒 Enterprise Sync Optimizations & Security

Free-tier `kvdb.io` key-value buckets are restricted to 1,000 operations per day. To prevent throttling (HTTP 429) during normal multi-device use, the application implements the following defenses:

1. **Smart Background Suspend:** Suspends database polling immediately when a phone screen is locked, the browser tab is hidden, or the app goes out of focus (`document.hidden`).
2. **Instant Visibility Sync:** Refreshes and pulls the list the exact millisecond the user unlocks their phone or returns to the browser tab, bypassing interval delay for a flawless user experience.
3. **Optimized Polling Loop:** Uses a balanced 10-second polling cadence when active, keeping lists fresh without exhausting quotas.
4. **Auto-Seeding:** Automatically checks for a 404 cloud record when pairing a new sync code and seeds the cloud with local items to prevent empty sync errors.
5. **Hostname Validation Regex:** Ensures external clones or forks of the repository cannot steal or exhaust your private bucket quota by falling back automatically to the public sandbox bucket.

---

## 📄 License
This repository is configured as a public recipe repository. Feel free to clone, customize, and deploy your own copy!