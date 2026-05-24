// DOM Elements
const sidebarContainer = document.getElementById('sidebar');
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

// Application State
let recipes = window.RECIPES || [];
let activeRecipeId = null;

// Initialize App
function init() {
    renderRecipeList(recipes);
    setupEventListeners();
    handleDeepLinking();
}

// Render the sidebar recipe list
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
        
        // Take a brief description snippet
        const descSnippet = recipe.description && recipe.description.length > 0 
            ? recipe.description[0] 
            : 'Ei kuvausta.';
            
        // Show first 3 ingredients as quick preview badges
        const previewIngredients = recipe.ingredients.slice(0, 3).map(ing => {
            // limit text length
            const name = ing.name.length > 15 ? ing.name.substring(0, 15) + '...' : ing.name;
            return `<span class="badge">${name}</span>`;
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

// Select and load a recipe
function selectRecipe(recipeId) {
    activeRecipeId = recipeId;
    
    // Update active class in sidebar items
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

    // Populate Detail View
    recipeTitleEl.textContent = recipe.title;
    
    // Render Description paragraphs
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

    // Render Ingredients List
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
        recipeIngredientsEl.appendChild(li);
    });

    // Render Instructions
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

    // Update visibility and state
    emptyStateEl.style.display = 'none';
    recipeDetailEl.style.display = 'flex';
    
    // Scroll detail to top
    mainContentContainer.scrollTop = 0;

    // Trigger URL deep-link hash update silently
    history.replaceState(null, null, `#${recipeId}`);

    // Trigger slide-in for mobile view
    document.querySelector('.app-container').classList.add('recipe-active');
}

// Event Listeners setup
function setupEventListeners() {
    // Search listener
    searchInput.addEventListener('input', handleSearch);

    // Clear search
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        renderRecipeList(recipes);
        searchInput.focus();
    });

    // Mobile back navigation button
    backBtn.addEventListener('click', () => {
        document.querySelector('.app-container').classList.remove('recipe-active');
        // Clear active class from sidebar item when exiting mobile view back to list
        const activeItem = recipeListContainer.querySelector('.recipe-item.active');
        if (activeItem) {
            activeItem.classList.remove('active');
        }
        activeRecipeId = null;
        history.replaceState(null, null, ' '); // remove hash
    });

    // Handle ESC key to exit recipe detail on mobile
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.querySelector('.app-container').classList.contains('recipe-active')) {
            backBtn.click();
        }
    });
}

// Search Logic
function handleSearch(e) {
    const query = e.target.value.toLowerCase().trim();

    if (query.length > 0) {
        clearSearchBtn.style.display = 'block';
    } else {
        clearSearchBtn.style.display = 'none';
    }

    // Filter recipes by Title, Description, or Ingredients
    const filteredRecipes = recipes.filter(recipe => {
        const titleMatch = recipe.title.toLowerCase().includes(query);
        
        const descMatch = recipe.description && recipe.description.some(p => 
            p.toLowerCase().includes(query)
        );
        
        const ingredientMatch = recipe.ingredients && recipe.ingredients.some(ing => 
            ing.name.toLowerCase().includes(query) || (ing.amount && ing.amount.toLowerCase().includes(query))
        );

        return titleMatch || descMatch || ingredientMatch;
    });

    renderRecipeList(filteredRecipes);
}

// Deep linking to recipes from the URL hash (e.g. #ajoblanco)
function handleDeepLinking() {
    const hash = window.location.hash.substring(1);
    if (hash) {
        const recipeExists = recipes.some(r => r.id === hash);
        if (recipeExists) {
            selectRecipe(hash);
            
            // Scroll sidebar active item into view
            setTimeout(() => {
                const activeItem = recipeListContainer.querySelector(`.recipe-item[data-id="${hash}"]`);
                if (activeItem) {
                    activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
            }, 100);
        }
    }
}

// Helper to escape HTML characters
function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Start application
document.addEventListener('DOMContentLoaded', init);
