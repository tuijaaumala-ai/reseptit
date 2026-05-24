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
const shareListBtn = document.getElementById('share-list-btn');

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

// Shopping List & Favorites State
let shoppingList = JSON.parse(localStorage.getItem('shopping_list_items')) || [];
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
let favorites = JSON.parse(localStorage.getItem('shopping_list_favorites')) || DEFAULT_FAVORITES;

// Cloud Sync State
let syncId = localStorage.getItem('shopping_list_id') || '';
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
        document.getElementById('tab-shopping').click();
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
            addShoppingItem(fav.name, '1 kpl');
            
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
    if (shoppingModeCheckbox.checked) {
        sortedList.sort((a, b) => {
            if (a.bought && !b.bought) return 1;
            if (!a.bought && b.bought) return -1;
            return 0;
        });
    }

    if (sortedList.length === 0) {
        shoppingEmptyEl.style.display = 'flex';
        return;
    } else {
        shoppingEmptyEl.style.display = 'none';
    }

    sortedList.forEach(item => {
        const li = document.createElement('li');
        li.classList.add('shopping-item');
        if (item.bought) li.classList.add('bought');
        
        const isFav = favorites.some(fav => fav.name.toLowerCase() === item.name.toLowerCase());
        
        li.innerHTML = `
            <div class="shopping-item-left">
                <input type="checkbox" id="shop-item-${item.id}" ${item.bought ? 'checked' : ''}>
                <label for="shop-item-${item.id}">
                    ${item.amount ? `<span class="amount">${escapeHTML(item.amount)}</span>` : ''}
                    <span class="name">${escapeHTML(item.name)}</span>
                </label>
            </div>
            <div class="shopping-item-actions">
                <button class="fav-heart-btn ${isFav ? 'active' : ''}" title="${isFav ? 'Poista suosikeista' : 'Lisää suosikkeihin'}">
                    ${isFav ? '❤️' : '🤍'}
                </button>
                <button class="delete-item-btn" title="Poista tuote">🗑️</button>
            </div>
        `;

        // Checkbox bought toggle
        const checkbox = li.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', () => toggleBought(item.id));

        // Favorite Toggle
        const heartBtn = li.querySelector('.fav-heart-btn');
        heartBtn.addEventListener('click', () => toggleFavorite(item.name));

        // Delete Button
        const delBtn = li.querySelector('.delete-item-btn');
        delBtn.addEventListener('click', () => deleteShoppingItem(item.id));

        shoppingListItemsContainer.appendChild(li);
    });
}

// Shopping list operations
function addShoppingItem(name, amount) {
    name = name.trim();
    amount = amount ? amount.trim() : '';
    if (!name) return;

    // Avoid duplicate unchecked items - merge quantity if unchecked
    const existingIndex = shoppingList.findIndex(item => 
        item.name.toLowerCase() === name.toLowerCase() && !item.bought
    );

    if (existingIndex > -1) {
        // If amount was provided, we append it, otherwise keep existing
        if (amount) {
            shoppingList[existingIndex].amount = amount;
        }
    } else {
        const newItem = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
            name: name,
            amount: amount,
            bought: false
        };
        shoppingList.unshift(newItem); // add to beginning
    }

    saveAndSync();
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
    
    localStorage.setItem('shopping_list_favorites', JSON.stringify(favorites));
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
    localStorage.setItem('shopping_list_items', JSON.stringify(shoppingList));
}

function setupShoppingEventListeners() {
    // Add Item Form
    addItemForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = newItemNameInput.value;
        const amount = newItemAmountInput.value;
        addShoppingItem(name, amount);
        
        newItemNameInput.value = '';
        newItemAmountInput.value = '';
        newItemNameInput.focus();
    });

    // Clear list button
    clearListBtn.addEventListener('click', clearList);

    // Shopping Mode checkbox toggling (resorts list on transition)
    shoppingModeCheckbox.addEventListener('change', () => {
        renderShoppingList();
    });

    // Share list button
    shareListBtn.addEventListener('click', () => {
        if (!syncId) {
            alert("Pilvisynkronointi ei ole valmis vielä. Yritä hetken kuluttua uudelleen.");
            return;
        }
        
        // Create sharing URL
        const shareUrl = `${window.location.origin}${window.location.pathname}?list=${syncId}`;
        
        // Copy to clipboard
        navigator.clipboard.writeText(shareUrl).then(() => {
            // Temporarily change button text for premium micro-feedback
            const originalText = shareListBtn.innerHTML;
            shareListBtn.innerHTML = "✅ Linkki kopioitu leikepöydälle!";
            shareListBtn.style.borderColor = "#10b981";
            shareListBtn.style.color = "#10b981";
            
            setTimeout(() => {
                shareListBtn.innerHTML = originalText;
                shareListBtn.style.borderColor = "";
                shareListBtn.style.color = "";
            }, 3000);
        }).catch(err => {
            console.error("Failed to copy link: ", err);
            // Fallback prompt
            prompt("Kopioi tästä linkki perheellesi:", shareUrl);
        });
    });
}

// ==========================================
// 📡 Real-time Cloud Synchronization (npoint)
// ==========================================

async function initSync() {
    // Check URL parameters for sharing list ID
    const urlParams = new URLSearchParams(window.location.search);
    const listParam = urlParams.get('list');
    
    if (listParam) {
        syncId = listParam;
        localStorage.setItem('shopping_list_id', syncId);
        // Silently clean URL
        window.history.replaceState(null, null, window.location.pathname + '?tab=shopping');
    }
    
    if (!syncId) {
        updateSyncStatus('syncing', 'Luodaan pilvilistaa...');
        try {
            // Create initial cloud list
            const response = await fetch('https://api.npoint.io', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: shoppingList })
            });
            const data = await response.json();
            if (data && data.id) {
                syncId = data.id;
                localStorage.setItem('shopping_list_id', syncId);
                updateSyncStatus('active', 'Yhdistetty pilveen');
            } else {
                throw new Error('Sync creation failed');
            }
        } catch (e) {
            console.error("Failed to create shared list:", e);
            updateSyncStatus('error', 'Vain paikallinen tila ( offline )');
        }
    } else {
        // Fetch existing list
        await loadFromCloud();
    }
    
    // Background polling every 10 seconds
    setInterval(loadFromCloud, 10000);
}

async function loadFromCloud() {
    if (!syncId || isSyncing) return;
    try {
        const response = await fetch(`https://api.npoint.io/${syncId}`);
        if (!response.ok) throw new Error("Sync load failed");
        
        const data = await response.json();
        if (data && Array.isArray(data.items)) {
            // Check if lists are actually different to prevent redraw loops
            if (JSON.stringify(shoppingList) !== JSON.stringify(data.items)) {
                shoppingList = data.items;
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
        const response = await fetch(`https://api.npoint.io/${syncId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: shoppingList })
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
    syncIndicator.className = 'sync-dot';
    syncIndicator.classList.add(status);
    syncStatusText.textContent = text;
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

document.addEventListener('DOMContentLoaded', init);
