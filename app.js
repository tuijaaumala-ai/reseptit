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
const forceRefreshBtn = document.getElementById('force-refresh-btn');
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

// ==========================================
// Item History (for autocomplete suggestions)
// ==========================================
let itemHistory = [];
try {
    const storedHistory = storage.getItem('shopping_item_history');
    if (storedHistory) {
        itemHistory = JSON.parse(storedHistory) || [];
    } else {
        // Seed with default favorites on first install
        itemHistory = DEFAULT_FAVORITES.map(f => f.name);
    }
    if (!Array.isArray(itemHistory)) itemHistory = [];
} catch(e) {
    itemHistory = DEFAULT_FAVORITES.map(f => f.name);
}

function addToHistory(name) {
    const normalized = name.trim();
    if (!normalized) return;
    // Move to top if already exists (most recent first)
    const idx = itemHistory.findIndex(h => h.toLowerCase() === normalized.toLowerCase());
    if (idx > -1) itemHistory.splice(idx, 1);
    itemHistory.unshift(normalized);
    storage.setItem('shopping_item_history', JSON.stringify(itemHistory));
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
let lastCloudSaveTime = 0;  // timestamp of last successful cloud save
let hasPendingChanges = false; // true while local changes not yet saved to cloud

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
                const isWidget = new URLSearchParams(window.location.search).has('widget');
                if (isWidget) {
                    history.replaceState(null, null, window.location.pathname + '?widget=true');
                } else {
                    history.replaceState(null, null, window.location.pathname + '?tab=shopping');
                }
            } else {
                history.replaceState(null, null, window.location.pathname + (activeRecipeId ? `#${activeRecipeId}` : ''));
            }
        });
    });

    // Check query params to switch to shopping tab on load
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    const isWidget = urlParams.has('widget') || urlParams.get('mode') === 'widget';
    if (isWidget) {
        document.body.classList.add('widget-mode');
    }
    if (tabParam === 'shopping' || urlParams.has('list') || isWidget) {
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
    const isWidgetMode = document.body.classList.contains('widget-mode');
    if ((shoppingModeCheckbox && shoppingModeCheckbox.checked) || isWidgetMode) {
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
        const isShoppingMode = (shoppingModeCheckbox && shoppingModeCheckbox.checked) || isWidgetMode;

        const leftHTML = `
            <span class="name">${escapeHTML(item.name)}</span>
        `;

        let actionsHTML = '';
        if (isShoppingMode) {
            actionsHTML = `
                <div class="stepper static-stepper" style="border: none; background: none; padding: 0; margin-right: 0.5rem;">
                    <span class="stepper-val" style="background: var(--border-color); padding: 0.35rem 0.65rem; border-radius: 6px; min-width: 2.2rem; text-align: center;">${quantity}</span>
                </div>
            `;
        } else {
            actionsHTML = `
                <div class="stepper">
                    <button class="stepper-btn dec-btn" title="Vähennä">-</button>
                    <span class="stepper-val">${quantity}</span>
                    <button class="stepper-btn inc-btn" title="Lisää">+</button>
                </div>
                <button class="fav-heart-btn ${isFav ? 'active' : ''}" title="${isFav ? 'Poista suosikeista' : 'Lisää suosikkeihin'}">
                    ${isFav ? '❤️' : '🤍'}
                </button>
                <button class="delete-item-btn" title="Poista tuote">🗑️</button>
            `;
        }

        li.innerHTML = `
            <div class="shopping-item-left">
                ${leftHTML}
            </div>
            <div class="shopping-item-actions">
                ${actionsHTML}
            </div>
        `;

        // Click left area to toggle bought status (only in shopping mode)
        if (isShoppingMode) {
            const leftEl = li.querySelector('.shopping-item-left');
            if (leftEl) {
                leftEl.style.cursor = 'pointer';
                leftEl.title = item.bought ? 'Poista merkintä' : 'Merkitse ostetuksi';
                leftEl.addEventListener('click', () => toggleBought(item.id));
            }
        }

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

    // Save to history for autocomplete
    addToHistory(name);

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
    if (shoppingList.length === 0) return;
    
    const confirmClear = confirm("Haluatko tyhjentää koko ostoslistan?");
    if (confirmClear) {
        shoppingList = [];
        saveLocallyOnly();
        renderShoppingList();
        // Clear is critical — save immediately, no debounce
        if (syncTimeout) clearTimeout(syncTimeout);
        saveToCloud();
    }
}

// State persist & Cloud synchronization trigger
function saveAndSync() {
    saveLocallyOnly();
    renderShoppingList();
    
    // Mark as having unsaved changes (blocks poll from overwriting pending items)
    hasPendingChanges = true;
    
    // Safety: always reset hasPendingChanges after max 10s, even if save hangs
    const safetyReset = setTimeout(() => { hasPendingChanges = false; }, 10000);
    
    // Debounced cloud save (500ms)
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(async () => {
        await saveToCloud();
        hasPendingChanges = false;
        clearTimeout(safetyReset);
    }, 500);
}

function saveLocallyOnly() {
    storage.setItem('shopping_list_items', JSON.stringify(shoppingList));
}

function setupShoppingEventListeners() {
    // Add Item Form
    if (addItemForm) {
        addItemForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = newItemNameInput.value.trim();
            if (name) {
                addShoppingItem(name);
                newItemNameInput.value = '';
                closeAutocomplete();
                newItemNameInput.focus();
            }
        });
    }

    // Autocomplete setup
    setupAutocomplete();

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

    // Force refresh button
    if (forceRefreshBtn) {
        forceRefreshBtn.addEventListener('click', async () => {
            // Clear pending state and force immediate poll
            hasPendingChanges = false;
            forceRefreshBtn.style.opacity = '0.4';
            forceRefreshBtn.style.transform = 'rotate(180deg)';
            forceRefreshBtn.style.transition = 'transform 0.5s';
            await loadFromCloud();
            setTimeout(() => {
                forceRefreshBtn.style.opacity = '';
                forceRefreshBtn.style.transform = '';
            }, 600);
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

// ==========================================
// Autocomplete / Tuotehistoria
// ==========================================
let autocompleteActiveIndex = -1;
const autocompleteDropdown = document.getElementById('autocomplete-suggestions');

function closeAutocomplete() {
    if (autocompleteDropdown) {
        autocompleteDropdown.innerHTML = '';
        autocompleteDropdown.style.display = 'none';
    }
    autocompleteActiveIndex = -1;
}

function setupAutocomplete() {
    const input = newItemNameInput;
    const dropdown = autocompleteDropdown;
    if (!input || !dropdown) return;

    function getSuggestions(query) {
        if (!query || query.length < 1) return [];
        const q = query.toLowerCase();
        return itemHistory
            .filter(name => name.toLowerCase().includes(q) && name.toLowerCase() !== q)
            .slice(0, 8);
    }

    function renderSuggestions(suggestions, query) {
        if (suggestions.length === 0) { closeAutocomplete(); return; }
        const q = query.toLowerCase();
        dropdown.innerHTML = suggestions.map((s, i) => {
            // Highlight matching substring
            const lo = s.toLowerCase();
            const start = lo.indexOf(q);
            let highlighted = escapeHTML(s);
            if (start >= 0) {
                highlighted =
                    escapeHTML(s.substring(0, start)) +
                    `<strong>${escapeHTML(s.substring(start, start + q.length))}</strong>` +
                    escapeHTML(s.substring(start + q.length));
            }
            return `<div class="autocomplete-item" role="option" data-value="${escapeHTML(s)}" data-index="${i}">${highlighted}</div>`;
        }).join('');
        dropdown.style.display = 'block';
        autocompleteActiveIndex = -1;
    }

    function setActiveItem(index) {
        const items = dropdown.querySelectorAll('.autocomplete-item');
        items.forEach(el => el.classList.remove('active'));
        if (index >= 0 && index < items.length) {
            items[index].classList.add('active');
            items[index].scrollIntoView({ block: 'nearest' });
        }
        autocompleteActiveIndex = index;
    }

    function selectAndClose(value) {
        input.value = value;
        closeAutocomplete();
        input.focus();
    }

    // Show suggestions as user types
    input.addEventListener('input', () => {
        renderSuggestions(getSuggestions(input.value), input.value);
    });

    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
        if (dropdown.style.display === 'none' || !dropdown.innerHTML) return;
        const items = dropdown.querySelectorAll('.autocomplete-item');
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveItem(Math.min(autocompleteActiveIndex + 1, items.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveItem(Math.max(autocompleteActiveIndex - 1, -1));
        } else if (e.key === 'Enter' && autocompleteActiveIndex >= 0 && items[autocompleteActiveIndex]) {
            e.preventDefault();
            const val = items[autocompleteActiveIndex].getAttribute('data-value');
            selectAndClose(val);
            // Immediately add to list
            addShoppingItem(val);
            input.value = '';
            closeAutocomplete();
        } else if (e.key === 'Escape') {
            closeAutocomplete();
        }
    });

    // Mouse click on suggestion
    dropdown.addEventListener('mousedown', (e) => {
        const item = e.target.closest('.autocomplete-item');
        if (item) {
            e.preventDefault(); // prevent blur before click registers
            selectAndClose(item.getAttribute('data-value'));
        }
    });

    // Close on blur (small delay so mousedown click can fire first)
    input.addEventListener('blur', () => {
        setTimeout(closeAutocomplete, 160);
    });

    // Show all history on focus if input is empty
    input.addEventListener('focus', () => {
        if (input.value) {
            renderSuggestions(getSuggestions(input.value), input.value);
        }
    });
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
    
    // Background polling every 5 seconds
    setInterval(loadFromCloud, 5000);
}

async function loadFromCloud() {
    if (!syncId) return;
    // Block poll if we have local changes not yet saved — prevents overwriting pending items
    if (isSyncing || hasPendingChanges) {
        console.log('[Sync] Poll skipped — pending changes or save in progress');
        return;
    }
    try {
        const response = await fetch(`https://kvdb.io/${bucketId}/${syncId}?t=${Date.now()}`);
        if (response.status === 404) {
            updateSyncStatus('active', 'Yhdistetty pilveen');
            return;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const text = await response.text();
        console.log('[Sync] Raw cloud response:', text.substring(0, 100));
        
        // Parse safely
        let data;
        try { data = JSON.parse(text); } catch(e) {
            console.error('[Sync] Failed to parse cloud data:', text);
            return;
        }
        
        // Accept both empty array AND populated array
        if (!Array.isArray(data)) {
            console.warn('[Sync] Cloud returned non-array:', data);
            return;
        }

        // === SMART MERGE by item ID ===
        const cloudIsEmpty = data.length === 0;
        
        if (cloudIsEmpty && shoppingList.length > 0) {
            // Cloud was explicitly cleared — wipe local too
            console.log('[Sync] Cloud is empty — clearing local list');
            shoppingList = [];
            saveLocallyOnly();
            renderShoppingList();
            updateSyncStatus('active', 'Yhdistetty pilveen');
            return;
        }
        
        // Build a map of cloud items by ID
        const cloudMap = new Map(data.map(item => [item.id, item]));
        const localMap = new Map(shoppingList.map(item => [item.id, item]));
        
        let changed = false;
        
        // Step 1: Add cloud items that are missing locally
        for (const [id, cloudItem] of cloudMap) {
            if (!localMap.has(id)) {
                console.log('[Sync] Adding missing item from cloud:', cloudItem.name);
                shoppingList.push(cloudItem);
                changed = true;
            } else {
                // Update bought/quantity state from cloud
                const localItem = localMap.get(id);
                if (localItem.bought !== cloudItem.bought || localItem.quantity !== cloudItem.quantity) {
                    localItem.bought = cloudItem.bought;
                    localItem.quantity = cloudItem.quantity;
                    changed = true;
                }
            }
        }
        
        // Step 2: Remove local items that were deleted by another device,
        // BUT only if they were known to exist at the time of our last save.
        // Items added AFTER lastCloudSaveTime are pending uploads — don't remove them.
        if (!cloudIsEmpty) {
            const beforeLen = shoppingList.length;
            shoppingList = shoppingList.filter(item => {
                if (cloudMap.has(item.id)) return true; // in cloud, keep
                // Extract the creation timestamp from the item ID (first 13 chars = Date.now())
                const addedAt = parseInt(item.id.substring(0, 13)) || 0;
                const isPendingUpload = addedAt > lastCloudSaveTime;
                if (isPendingUpload) {
                    console.log('[Sync] Keeping pending item (not yet saved):', item.name);
                    return true;  // keep — it was added after our last save, hasn't synced yet
                }
                console.log('[Sync] Removing item deleted by another device:', item.name);
                return false;
            });
            if (shoppingList.length !== beforeLen) changed = true;
        }
        
        if (changed) {
            saveLocallyOnly();
            renderShoppingList();
        }
        updateSyncStatus('active', 'Yhdistetty pilveen');
    } catch (e) {
        console.error("Sync load failed:", e);
        updateSyncStatus('error', 'Yhteysvirhe');
    }
}

async function saveToCloud() {
    if (!syncId) return;
    isSyncing = true;
    updateSyncStatus('syncing', 'Tallennetaan...');
    try {
        const body = JSON.stringify(shoppingList);
        console.log('[Sync] Saving to cloud. Items:', shoppingList.length, 'Key:', syncId);
        const response = await fetch(`https://kvdb.io/${bucketId}/${syncId}`, {
            method: 'POST',
            body: body
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errText}`);
        }
        console.log('[Sync] Saved OK');
        lastCloudSaveTime = Date.now();  // mark successful save time
        updateSyncStatus('active', 'Yhdistetty pilveen');
    } catch (e) {
        console.error("Sync save failed:", e);
        updateSyncStatus('error', `Tallennus epäonnistui: ${e.message}`);
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
        // Always append the sync code as a small badge for easy verification
        const codeHtml = syncId
            ? ` <span style="font-size: 0.75rem; background: var(--bg-hover); color: var(--text-muted); border: 1px solid var(--border-color); padding: 1px 5px; border-radius: 4px; font-family: monospace; font-weight: 700; letter-spacing: 0.05em; cursor:pointer;" title="Oma sync-koodi" onclick="showSyncCodeModal()">#${syncId.substring(0,6).toUpperCase()}</span>`
            : '';
        syncStatusText.innerHTML = `${text}${codeHtml}`;
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
