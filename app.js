// ==========================================
// DOM Elements - Navigation & Core Panels
// ==========================================
const navTabs = document.querySelectorAll('.nav-tab');
const tabPanels = document.querySelectorAll('.tab-panel');

// ==========================================
// DOM Elements - Recipe Browser
// ==========================================
const recipeListContainer = document.getElementById('recipe-list');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const recipesCountEl = document.getElementById('recipes-count');

const mainContentContainer = document.getElementById('main-content');
const emptyStateEl = document.getElementById('empty-state');
const recipeDetailEl = document.getElementById('recipe-detail');

const backBtn = document.getElementById('back-btn');
const recipeTitleEl = document.getElementById('recipe-title');
const recipeDescEl = document.getElementById('recipe-desc');
const recipeIngredientsEl = document.getElementById('recipe-ingredients');
const recipeInstructionsEl = document.getElementById('recipe-instructions');

// ==========================================
// DOM Elements - Shopping List
// ==========================================
const syncIndicator = document.getElementById('sync-indicator');
const syncStatusText = document.getElementById('sync-status-text');
const showSyncCodeBtn = document.getElementById('show-sync-code-btn');
const joinSyncBtn = document.getElementById('join-sync-btn');
const syncModalOverlay = document.getElementById('sync-modal-overlay');
const syncModalContent = document.getElementById('sync-modal-content');
const syncModalClose = document.getElementById('sync-modal-close');

const favoritesGrid = document.getElementById('favorites-grid');
const addItemForm = document.getElementById('add-item-form');
const newItemNameInput = document.getElementById('new-item-name');
const newItemAmountInput = document.getElementById('new-item-amount');

const shoppingModeCheckbox = document.getElementById('shopping-mode-checkbox');
const clearListBtn = document.getElementById('clear-list-btn');
const shoppingListItemsContainer = document.getElementById('shopping-list-items');
const shoppingEmptyEl = document.getElementById('shopping-empty');

// ==========================================
// Application State
// ==========================================
let recipes = window.RECIPES || [];
let activeRecipeId = null;

// Safe localStorage helper to prevent crashes in private mode or strict browsers
const storage = {
    getItem(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn("Storage getItem failed:", e);
            return null;
        }
    },
    setItem(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            console.warn("Storage setItem failed:", e);
            return false;
        }
    }
};

// Shopping List & Favorites State
let shoppingList = [];
try {
    shoppingList = JSON.parse(storage.getItem('shopping_list_items')) || [];
    if (!Array.isArray(shoppingList)) shoppingList = [];
} catch (e) {
    console.error("Failed to parse shopping list items:", e);
    shoppingList = [];
}

const DEFAULT_FAVORITES = [
    { name: "Maito", favorite: true },
    { name: "Leipä", favorite: true },
    { name: "Kananmunat", favorite: true },
    { name: "Voi", favorite: true },
    { name: "Kahvi", favorite: true },
    { name: "Juusto", favorite: true },
    { name: "Banaanit", favorite: true },
    { name: "Omenat", favorite: true }
];

let favorites = DEFAULT_FAVORITES;
try {
    const storedFavs = storage.getItem('shopping_list_favorites');
    if (storedFavs) {
        favorites = JSON.parse(storedFavs) || DEFAULT_FAVORITES;
    }
} catch (e) {
    console.error("Failed to parse shopping list favorites:", e);
    favorites = DEFAULT_FAVORITES;
}

// Cloud Sync State
const bucketId = 'PUqaJ6qUo9yJGpRJ6YMv9m';
let syncId = '';

// IMPORTANT: Read ?list= param IMMEDIATELY before any code can wipe the URL
(function readListParamEarly() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const listParam = urlParams.get('list');
        if (listParam) {
            // Store immediately so initSync & navigation don't overwrite with a new key
            syncId = listParam;
            storage.setItem('shopping_list_id', listParam);
            console.log('[Sync] Joining shared list from URL:', listParam);
        } else {
            syncId = storage.getItem('shopping_list_id') || '';
        }
    } catch (e) {
        console.error("Failed to read syncId:", e);
        try { syncId = storage.getItem('shopping_list_id') || ''; } catch(_) {}
    }
})();

let isSyncing = false;
let syncTimeout = null;

// ==========================================
// Initialization
// ==========================================
function init() {
    setupNavigation();
    renderRecipeList(recipes);
    setupRecipeEventListeners();
    handleDeepLinking();
    
    // Shopping List Init
    renderFavorites();
    renderShoppingList();
    setupShoppingEventListeners();
    initSync();
}

// ==========================================
// Navigation & Tab Switching Logic
// ==========================================
function setupNavigation() {
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.getAttribute('data-target');
            
            // Toggle active tabs
            navTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Toggle active panels
            tabPanels.forEach(panel => {
                if (panel.id === targetId) {
                    panel.classList.add('active');
                } else {
                    panel.classList.remove('active');
                }
            });

            // Adjust URL to prevent carrying hashes or search terms to other tabs
            if (targetId === 'panel-shopping') {
                history.replaceState(null, null, window.location.pathname + '?tab=shopping');
            } else {
                history.replaceState(null, null, window.location.pathname + (activeRecipeId ? `#${activeRecipeId}` : ''));
            }
        });
    });

    // Check query params to switch to shopping tab on load
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam === 'shopping' || urlParams.has('list')) {
        const shopTab = document.getElementById('tab-shopping');
        if (shopTab) {
            shopTab.click();
        }
    }
}

// ==========================================
// Recipe Archive Logic
// ==========================================
function renderRecipeList(recipesToRender) {
    recipeListContainer.innerHTML = '';
    recipesCountEl.textContent = recipesToRender.length;

    if (recipesToRender.length === 0) {
        recipeListContainer.innerHTML = `
            <div class="no-results" style="padding: 2rem 1rem; text-align: center; color: var(--text-muted); font-size: 0.95rem;">
                Ei reseptejä hakutuloksilla 🔍
            </div>
        `;
        return;
    }

    recipesToRender.forEach(recipe => {
        const item = document.createElement('div');
        item.classList.add('recipe-item');
        if (recipe.id === activeRecipeId) {
            item.classList.add('active');
        }
        item.setAttribute('data-id', recipe.id);
        
        const descSnippet = recipe.description && recipe.description.length > 0 
            ? recipe.description[0] 
            : 'Ei kuvausta.';
            
        const previewIngredients = recipe.ingredients.slice(0, 3).map(ing => {
            const name = ing.name.length > 15 ? ing.name.substring(0, 15) + '...' : ing.name;
            return `<span class="badge">${escapeHTML(name)}</span>`;
        }).join('');

        item.innerHTML = `
            <h3>${escapeHTML(recipe.title)}</h3>
            <p>${escapeHTML(descSnippet)}</p>
            <div class="ingredient-badges">
                ${previewIngredients}
                ${recipe.ingredients.length > 3 ? `<span class="badge">+${recipe.ingredients.length - 3}</span>` : ''}
            </div>
        `;

        item.addEventListener('click', () => selectRecipe(recipe.id));
        recipeListContainer.appendChild(item);
    });
}

function selectRecipe(recipeId) {
    activeRecipeId = recipeId;
    
    const items = recipeListContainer.querySelectorAll('.recipe-item');
    items.forEach(item => {
        if (item.getAttribute('data-id') === recipeId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    recipeTitleEl.textContent = recipe.title;
    
    recipeDescEl.innerHTML = '';
    if (recipe.description && recipe.description.length > 0) {
        recipe.description.forEach(p => {
            const pEl = document.createElement('p');
            pEl.textContent = p;
            recipeDescEl.appendChild(pEl);
        });
        recipeDescEl.style.display = 'block';
    } else {
        recipeDescEl.style.display = 'none';
    }

    recipeIngredientsEl.innerHTML = '';
    recipe.ingredients.forEach((ing, index) => {
        const li = document.createElement('li');
        const checkboxId = `ing-${recipeId}-${index}`;
        
        li.innerHTML = `
            <label for="${checkboxId}">
                <input type="checkbox" id="${checkboxId}">
                ${ing.amount ? `<span class="amount">${escapeHTML(ing.amount)}</span>` : ''}
                <span class="name">${escapeHTML(ing.name)}</span>
            </label>
        `;
        
        // Connect listener to automatically add clicked ingredients to the shopping list if checked!
        const checkbox = li.querySelector('input');
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                addShoppingItem(ing.name, ing.amount);
            }
        });

        recipeIngredientsEl.appendChild(li);
    });

    recipeInstructionsEl.innerHTML = '';
    if (recipe.instructions && recipe.instructions.length > 0) {
        recipe.instructions.forEach(step => {
            const p = document.createElement('p');
            p.textContent = step;
            recipeInstructionsEl.appendChild(p);
        });
    } else {
        recipeInstructionsEl.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">Ei ohjeita kirjoitettuna.</p>';
    }

    emptyStateEl.style.display = 'none';
    recipeDetailEl.style.display = 'flex';
    mainContentContainer.scrollTop = 0;

    history.replaceState(null, null, `#${recipeId}`);
    document.querySelector('.app-container').classList.add('recipe-active');
}

function setupRecipeEventListeners() {
    searchInput.addEventListener('input', handleSearch);

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        renderRecipeList(recipes);
        searchInput.focus();
    });

    backBtn.addEventListener('click', () => {
        document.querySelector('.app-container').classList.remove('recipe-active');
        const activeItem = recipeListContainer.querySelector('.recipe-item.active');
        if (activeItem) {
            activeItem.classList.remove('active');
        }
        activeRecipeId = null;
        history.replaceState(null, null, ' ');
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.querySelector('.app-container').classList.contains('recipe-active')) {
            backBtn.click();
        }
    });
}

function handleSearch(e) {
    const query = e.target.value.toLowerCase().trim();

    if (query.length > 0) {
        clearSearchBtn.style.display = 'block';
    } else {
        clearSearchBtn.style.display = 'none';
    }

    const filteredRecipes = recipes.filter(recipe => {
        const titleMatch = recipe.title.toLowerCase().includes(query);
        const descMatch = recipe.description && recipe.description.some(p => p.toLowerCase().includes(query));
        const ingredientMatch = recipe.ingredients && recipe.ingredients.some(ing => 
            ing.name.toLowerCase().includes(query) || (ing.amount && ing.amount.toLowerCase().includes(query))
        );
        return titleMatch || descMatch || ingredientMatch;
    });

    renderRecipeList(filteredRecipes);
}

function handleDeepLinking() {
    const hash = window.location.hash.substring(1);
    if (hash) {
        const recipeExists = recipes.some(r => r.id === hash);
        if (recipeExists) {
            selectRecipe(hash);
            setTimeout(() => {
                const activeItem = recipeListContainer.querySelector(`.recipe-item[data-id="${hash}"]`);
                if (activeItem) {
                    activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
            }, 100);
        }
    }
}

// ==========================================
// 🛒 Shared Shopping List Logic
// ==========================================

function renderFavorites() {
    favoritesGrid.innerHTML = '';
    
    favorites.forEach(fav => {
        const chip = document.createElement('div');
        chip.classList.add('favorite-chip');
        chip.innerHTML = `
            <span>${escapeHTML(fav.name)}</span>
            <button class="fav-heart-btn active" title="Poista suosikeista">❤️</button>
        `;
        
        // Click chip to quick-add item to active list
        chip.addEventListener('click', (e) => {
            // If click was on the heart button, toggle favorite instead of adding to list
            if (e.target.classList.contains('fav-heart-btn')) {
                e.stopPropagation();
                toggleFavorite(fav.name);
                return;
            }
            addShoppingItem(fav.name);
            
            // Small click scale dynamic micro-animation
            chip.style.transform = 'scale(0.95)';
            setTimeout(() => chip.style.transform = 'scale(1)', 100);
        });
        
        favoritesGrid.appendChild(chip);
    });
    
    if (favorites.length === 0) {
        favoritesGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 1rem 0;">
                Ei suosikkeja lisättynä. Voit merkitä tuotteita suosikeiksi ostoslistassa!
            </div>
        `;
    }
}

function renderShoppingList() {
    shoppingListItemsContainer.innerHTML = '';
    
    // Sort logic based on Shopping Mode (Ostosmoodi)
    // If Shopping Mode is checked: move checked/bought items to the bottom of the list
    let sortedList = [...shoppingList];
    if (shoppingModeCheckbox && shoppingModeCheckbox.checked) {
        sortedList.sort((a, b) => {
            if (a.bought && !b.bought) return 1;
            if (!a.bought && b.bought) return -1;
            return 0;
        });
    }

    if (sortedList.length === 0) {
        if (shoppingEmptyEl) shoppingEmptyEl.style.display = 'flex';
        return;
    } else {
        if (shoppingEmptyEl) shoppingEmptyEl.style.display = 'none';
    }

    sortedList.forEach(item => {
        const li = document.createElement('li');
        li.classList.add('shopping-item');
        if (item.bought) li.classList.add('bought');
        
        const isFav = favorites.some(fav => fav.name.toLowerCase() === item.name.toLowerCase());
        const quantity = item.quantity || 1;
        
        li.innerHTML = `
            <div class="shopping-item-left">
                <input type="checkbox" id="shop-item-${item.id}" ${item.bought ? 'checked' : ''}>
                <label for="shop-item-${item.id}">
                    <span class="name">${escapeHTML(item.name)}</span>
                </label>
            </div>
            <div class="shopping-item-actions">
                <div class="stepper">
                    <button class="stepper-btn dec-btn" title="Vähennä">-</button>
                    <span class="stepper-val">${quantity}</span>
                    <button class="stepper-btn inc-btn" title="Lisää">+</button>
                </div>
                <button class="fav-heart-btn ${isFav ? 'active' : ''}" title="${isFav ? 'Poista suosikeista' : 'Lisää suosikkeihin'}">
                    ${isFav ? '❤️' : '🤍'}
                </button>
                <button class="delete-item-btn" title="Poista tuote">🗑️</button>
            </div>
        `;

        // Checkbox bought toggle
        const checkbox = li.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.addEventListener('change', () => toggleBought(item.id));

        // Stepper buttons
        const decBtn = li.querySelector('.dec-btn');
        if (decBtn) decBtn.addEventListener('click', () => changeQuantity(item.id, -1));

        const incBtn = li.querySelector('.inc-btn');
        if (incBtn) incBtn.addEventListener('click', () => changeQuantity(item.id, 1));

        // Favorite Toggle
        const heartBtn = li.querySelector('.fav-heart-btn');
        if (heartBtn) heartBtn.addEventListener('click', () => toggleFavorite(item.name));

        // Delete Button
        const delBtn = li.querySelector('.delete-item-btn');
        if (delBtn) delBtn.addEventListener('click', () => deleteShoppingItem(item.id));

        shoppingListItemsContainer.appendChild(li);
    });
}

// Shopping list operations
function addShoppingItem(name, amount = '') {
    name = name.trim();
    if (!name) return;

    // Avoid duplicate unchecked items - increment quantity if unchecked
    const existing = shoppingList.find(item => 
        item.name.toLowerCase() === name.toLowerCase() && !item.bought
    );

    if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
    } else {
        const newItem = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
            name: name,
            quantity: 1,
            bought: false
        };
        shoppingList.unshift(newItem); // add to beginning
    }

    saveAndSync();
}

function changeQuantity(itemId, delta) {
    const item = shoppingList.find(i => i.id === itemId);
    if (item) {
        item.quantity = Math.max(1, (item.quantity || 1) + delta);
        saveAndSync();
    }
}

function toggleBought(itemId) {
    const item = shoppingList.find(i => i.id === itemId);
    if (item) {
        item.bought = !item.bought;
        saveAndSync();
    }
}

function deleteShoppingItem(itemId) {
    shoppingList = shoppingList.filter(i => i.id !== itemId);
    saveAndSync();
}

function toggleFavorite(name) {
    name = name.trim();
    if (!name) return;
    
    const index = favorites.findIndex(f => f.name.toLowerCase() === name.toLowerCase());
    if (index > -1) {
        // Remove from favorites
        favorites.splice(index, 1);
    } else {
        // Add to favorites
        favorites.push({ name: name, favorite: true });
    }
    
    storage.setItem('shopping_list_favorites', JSON.stringify(favorites));
    renderFavorites();
    renderShoppingList(); // updates heart icons in list
}

function clearList() {
    // Show beautiful custom notification confirmation or prompt
    if (shoppingList.length === 0) return;
    
    const confirmClear = confirm("Haluatko tyhjentää koko ostoslistan?");
    if (confirmClear) {
        shoppingList = [];
        saveAndSync();
    }
}

// State persist & Cloud synchronization trigger
function saveAndSync() {
    saveLocallyOnly();
    renderShoppingList();
    
    // Throttled/Debounced cloud synchronization to avoid API spamming
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(saveToCloud, 1000);
}

function saveLocallyOnly() {
    storage.setItem('shopping_list_items', JSON.stringify(shoppingList));
}

function setupShoppingEventListeners() {
    // Add Item Form
    if (addItemForm) {
        addItemForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = newItemNameInput.value;
            addShoppingItem(name);
            
            newItemNameInput.value = '';
            newItemNameInput.focus();
        });
    }

    // Clear list button
    if (clearListBtn) {
        clearListBtn.addEventListener('click', clearList);
    }

    // Shopping Mode checkbox toggling (resorts list on transition)
    if (shoppingModeCheckbox) {
        shoppingModeCheckbox.addEventListener('change', () => {
            renderShoppingList();
        });
    }

    // Show sync code button
    if (showSyncCodeBtn) {
        showSyncCodeBtn.addEventListener('click', showSyncCodeModal);
    }

    // Join sync button
    if (joinSyncBtn) {
        joinSyncBtn.addEventListener('click', showJoinModal);
    }

    // Modal close
    if (syncModalClose) {
        syncModalClose.addEventListener('click', closeSyncModal);
    }
    if (syncModalOverlay) {
        syncModalOverlay.addEventListener('click', (e) => {
            if (e.target === syncModalOverlay) closeSyncModal();
        });
    }
}

function closeSyncModal() {
    if (syncModalOverlay) syncModalOverlay.style.display = 'none';
}

function showSyncCodeModal() {
    if (!syncModalContent || !syncModalOverlay) return;
    const displayCode = syncId ? syncId.toUpperCase() : '...';
    syncModalContent.innerHTML = `
        <div style="text-align:center; padding: 0.5rem 0;">
            <div style="font-size: 2.8rem; margin-bottom: 0.5rem;">📋</div>
            <h3 style="margin: 0 0 0.5rem; font-size: 1.1rem; color: var(--text-color);">Tämän laitteen sync-koodi</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 1.2rem;">Anna tämä koodi toiselle laitteelle, niin listat yhdistyvät.</p>
            <div id="sync-code-display" style="
                font-family: monospace;
                font-size: 2rem;
                font-weight: 700;
                letter-spacing: 0.4em;
                background: var(--bg-hover);
                border: 2px solid var(--primary-color);
                border-radius: 12px;
                padding: 1rem 1.5rem;
                margin-bottom: 1.2rem;
                color: var(--primary-color);
                cursor: pointer;
                user-select: all;
            ">${displayCode}</div>
            <button id="copy-sync-code-btn" style="
                background: var(--primary-color);
                color: white;
                border: none;
                border-radius: 8px;
                padding: 0.7rem 1.5rem;
                font-size: 0.95rem;
                font-weight: 600;
                cursor: pointer;
                width: 100%;
            ">📋 Kopioi koodi leikepöydälle</button>
        </div>
    `;
    syncModalOverlay.style.display = 'flex';
    
    document.getElementById('copy-sync-code-btn').addEventListener('click', () => {
        navigator.clipboard.writeText(syncId).then(() => {
            document.getElementById('copy-sync-code-btn').textContent = '✅ Kopioitu!';
            setTimeout(() => { document.getElementById('copy-sync-code-btn').textContent = '📋 Kopioi koodi leikepöydälle'; }, 2000);
        }).catch(() => {
            prompt('Kopioi tämä koodi:', syncId);
        });
    });
}

function showJoinModal() {
    if (!syncModalContent || !syncModalOverlay) return;
    syncModalContent.innerHTML = `
        <div style="text-align:center; padding: 0.5rem 0;">
            <div style="font-size: 2.8rem; margin-bottom: 0.5rem;">🔗</div>
            <h3 style="margin: 0 0 0.5rem; font-size: 1.1rem; color: var(--text-color);">Liity jaettuun listaan</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 1.2rem;">Syötä toisen laitteen antama sync-koodi alle. Löydät sen painamalla "📋 Oma koodi".</p>
            <input id="join-code-input" type="text" placeholder="esim. A1B2C3D4" autocomplete="off" autocorrect="off" autocapitalize="characters" style="
                width: 100%;
                box-sizing: border-box;
                font-family: monospace;
                font-size: 1.6rem;
                font-weight: 700;
                letter-spacing: 0.2em;
                text-align: center;
                text-transform: uppercase;
                background: var(--bg-hover);
                border: 2px solid var(--border-color);
                border-radius: 12px;
                padding: 0.9rem 1rem;
                margin-bottom: 1.2rem;
                color: var(--text-color);
                outline: none;
            ">
            <button id="join-code-submit-btn" style="
                background: var(--primary-color);
                color: white;
                border: none;
                border-radius: 8px;
                padding: 0.7rem 1.5rem;
                font-size: 0.95rem;
                font-weight: 600;
                cursor: pointer;
                width: 100%;
                margin-bottom: 0.6rem;
            ">🔗 Liity listalle</button>
            <p id="join-code-error" style="color: #ef4444; font-size: 0.85rem; min-height: 1.2em; margin: 0;"></p>
        </div>
    `;
    syncModalOverlay.style.display = 'flex';
    
    const joinInput = document.getElementById('join-code-input');
    joinInput.focus();
    
    document.getElementById('join-code-submit-btn').addEventListener('click', async () => {
        const code = joinInput.value.trim().toLowerCase();
        if (!code || code.length < 4) {
            document.getElementById('join-code-error').textContent = 'Syötä kelvollinen koodi.';
            return;
        }
        document.getElementById('join-code-submit-btn').textContent = 'Yhdistetään...';
        document.getElementById('join-code-submit-btn').disabled = true;
        
        // Save new syncId and load from cloud
        syncId = code;
        storage.setItem('shopping_list_id', code);
        closeSyncModal();
        updateSyncStatus('syncing', 'Yhdistetään...');
        
        try {
            await loadFromCloud();
            // If load succeeded, we're now on the shared list
            if (!isSyncing) {
                updateSyncStatus('active', 'Yhdistetty jaettuun listaan');
            }
        } catch(e) {
            updateSyncStatus('error', 'Yhdistäminen epäonnistui');
        }
    });
}

// Generation of a clean, short unique perheavain if not sharing
function generateUniqueKey() {
    return Math.random().toString(36).substring(2, 10);
}

async function initSync() {
    // NOTE: ?list= param was already read and stored into syncId at page load
    // (see readListParamEarly IIFE above). We do NOT re-read it here to avoid
    // race conditions with history.replaceState in setupNavigation.
    
    if (!syncId) {
        updateSyncStatus('syncing', 'Luodaan pilvilistaa...');
        try {
            // Generate a random unique key and save current items immediately to kvdb.io
            syncId = generateUniqueKey();
            storage.setItem('shopping_list_id', syncId);
            console.log('[Sync] Created new shared list:', syncId);
            await saveToCloud();
            updateSyncStatus('active', 'Yhdistetty pilveen');
        } catch (e) {
            console.error("Failed to create shared list:", e);
            updateSyncStatus('error', 'Vain paikallinen tila ( offline )');
        }
    } else {
        console.log('[Sync] Using existing list ID:', syncId);
        // Fetch existing list from cloud
        await loadFromCloud();
    }
    
    // Background polling every 10 seconds
    setInterval(loadFromCloud, 10000);
}

async function loadFromCloud() {
    if (!syncId || isSyncing) return;
    try {
        const response = await fetch(`https://kvdb.io/${bucketId}/${syncId}`);
        if (response.status === 404) {
            // Key doesn't exist on the cloud yet (which is fine, e.g. newly generated key)
            return;
        }
        if (!response.ok) throw new Error("Sync load failed");
        
        const data = await response.json(); // Natively parses the full JSON array
        if (data && Array.isArray(data)) {
            // Check if lists are actually different to prevent redraw loops
            if (JSON.stringify(shoppingList) !== JSON.stringify(data)) {
                shoppingList = data;
                saveLocallyOnly();
                renderShoppingList();
            }
            updateSyncStatus('active', 'Yhdistetty pilveen');
        }
    } catch (e) {
        console.error("Sync load failed:", e);
        updateSyncStatus('error', 'Yhteysvirhe ( tallennus paikallisesti )');
    }
}

async function saveToCloud() {
    if (!syncId) return;
    isSyncing = true;
    updateSyncStatus('syncing', 'Tallennetaan...');
    try {
        // Post the raw JSON string directly to kvdb.io (supported naturally with CORS)
        const response = await fetch(`https://kvdb.io/${bucketId}/${syncId}`, {
            method: 'POST',
            body: JSON.stringify(shoppingList)
        });
        if (!response.ok) throw new Error("Sync save failed");
        updateSyncStatus('active', 'Yhdistetty pilveen');
    } catch (e) {
        console.error("Sync save failed:", e);
        updateSyncStatus('error', 'Synkronointi epäonnistui');
    } finally {
        isSyncing = false;
    }
}

function updateSyncStatus(status, text) {
    if (syncIndicator) {
        syncIndicator.className = 'sync-dot';
        syncIndicator.classList.add(status);
    }
    if (syncStatusText) {
        if (status === 'active' && syncId) {
            syncStatusText.innerHTML = `${text} <span class="sync-code-badge" style="font-size: 0.8rem; background: var(--bg-hover); color: var(--text-color); border: 1px solid var(--border-color); padding: 1px 6px; border-radius: 4px; font-family: monospace; font-weight: 600; margin-left: 6px; letter-spacing: 0.5px;">#${syncId}</span>`;
        } else {
            syncStatusText.textContent = text;
        }
    }
}

// ==========================================
// Utils
// ==========================================
function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Start application safely handling DOMContentLoaded race conditions
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
