import { HomeAssistant } from 'custom-card-helpers';
import { html, LitElement, TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { formatTime, getRecipeImageUrl, getRecipeUrl, imageOrientation, getMealieRecipe, parsePythonDict } from '../utils/helpers';
import localize from '../utils/translate.js';

export abstract class MealieBaseCard extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() protected error: string | null = null;
  @state() protected _loading = false;
  @state() protected _initialized = false;

  protected abstract config: any;
  protected abstract loadData(): Promise<void>;

  protected updated(changedProps: Map<string, any>): void {
    super.updated(changedProps);
    if (changedProps.has('hass') && this.hass && !this._initialized && !this._loading) {
      this.loadData();
    }
  }

  protected renderLoading(title: string): TemplateResult {
    return html`
      <ha-card>
        ${title ? this.renderHeader(title) : ''}
        <div class="loading">
          <div class="loading-text">${localize('editor.loading')}</div>
        </div>
      </ha-card>
    `;
  }

  protected renderError(title: string): TemplateResult {
    return html`
      <ha-card>
        ${title ? this.renderHeader(title) : ''}
        <div class="error">
          <div class="error-text">${this.error}</div>
        </div>
      </ha-card>
    `;
  }

  protected renderEmptyState(title: string, message: string): TemplateResult {
    return html`
      <ha-card>
        ${title ? this.renderHeader(title) : ''}
        <div class="no-meals">
          <div class="no-meals-text">${message}</div>
        </div>
      </ha-card>
    `;
  }

  protected renderHeader(title: string): TemplateResult {
    return html`
      <div class="header">
        <div class="title-container">
          <div class="title">${title}</div>
        </div>
      </div>
    `;
  }

  protected renderRecipeImage(recipe: any, clickable: boolean, showImage: boolean, group: string): TemplateResult | string {
    if (!showImage) return '';

    const imageUrl = getRecipeImageUrl(this.config.url, recipe.recipe_id, !!recipe.image);
    const recipeUrl = getRecipeUrl(this.config.url, recipe.slug, clickable, group);

    const imageElement = html`
      <div class="recipe-image-container">
        <img src="${imageUrl}" alt="${recipe.name}" class="recipe-image" loading="lazy" @error=${this.handleImageError} @load=${imageOrientation} />
      </div>
    `;

    return clickable && recipeUrl !== '#' ? html`<a href="${recipeUrl}" target="_blank" rel="noopener noreferrer" class="recipe-image-link">${imageElement}</a>` : imageElement;
  }

  protected renderRecipeName(recipe: any, clickable: boolean): TemplateResult {
    const recipeUrl = getRecipeUrl(this.config.url, recipe.slug, clickable, this.config.group);
    const nameElement = html`<h3 class="recipe-name">${recipe.name}</h3>`;

    return clickable && recipeUrl !== '#' ? html`<a href="${recipeUrl}" target="_blank" rel="noopener noreferrer" class="recipe-name-link">${nameElement}</a>` : nameElement;
  }

  protected renderRecipeDescription(description: string, showDescription: boolean): TemplateResult | string {
    return showDescription && description ? html`<p class="recipe-description">${description}</p>` : '';
  }

  protected renderRecipeTimes(recipe: any, showPrepTime: boolean, showPerformTime: boolean, showTotalTime: boolean): TemplateResult | string {
    const timeBadges = [
      showPrepTime && recipe.prep_time ? this.renderTimeBadge('⏱️', formatTime(recipe.prep_time, this.hass)) : null,
      showPerformTime && recipe.perform_time ? this.renderTimeBadge('🔥', formatTime(recipe.perform_time, this.hass)) : null,
      showTotalTime && recipe.total_time ? this.renderTimeBadge('⏰', formatTime(recipe.total_time, this.hass)) : null
    ].filter(Boolean);

    return timeBadges.length > 0 ? html`<div class="recipe-times">${timeBadges}</div>` : '';
  }

  protected renderTimeBadge(icon: string, label: string): TemplateResult {
    return html`
      <span class="time-badge">
        <span class="time-icon">${icon}</span>
        <span class="time-value">${label}</span>
      </span>
    `;
  }

  protected renderRecipeIngredients(ingredients: any[], showIngredients: boolean): TemplateResult | string {
    if (showIngredients && ingredients?.length > 0) {
      console.log('[Mealie Card - DEBUG INGREDIENTS]', JSON.stringify(ingredients, null, 2));
    }
    if (!showIngredients || !ingredients || ingredients.length === 0) return '';

    return html`
      <div class="recipe-ingredients">
        <h4>${localize('common.ingredients') || 'Ingredients'}</h4>
        <ul>
          ${ingredients.map(ingredient => {
      // Fallback: Parse unit if it's a stringified Python dict
      let unit = ingredient.unit;
      if (typeof unit === 'string' && unit.trim().startsWith('{')) {
        const parsed = parsePythonDict(unit);
        if (parsed && typeof parsed === 'object') {
          unit = parsed;
        }
      }

      // Extract unit name safely
      const unitName = unit?.name || (typeof unit === 'string' ? unit : '') || '';

      // Extract food name - handle is_food=null/missing by checking note or display
      // If food is missing, we try to use the note as the name if it exists
      const foodName = ingredient.food?.name || ingredient.display || '';
      const note = ingredient.note || '';

      // Construct display string
      // Case 1: Quantity + Unit + Food
      // Case 2: Quantity + Food (no unit)
      // Case 3: Food only (no quantity)
      // Case 4: Note used as food name if food is missing

      const renderQuantity = ingredient.quantity ? html`<span class="ingredient-quantity">${ingredient.quantity} ${unitName}</span>` : '';
      const renderName = foodName ? html`<span class="ingredient-name">${foodName}</span>` : '';
      const renderNote = note && note !== foodName ? html`<span class="ingredient-note">(${note})</span>` : '';

      // If we have absolutely no name, shows "Unknown Ingredient" to alert user
      const finalName = renderName || (note ? html`<span class="ingredient-name">${note}</span>` : html`<span class="ingredient-name" style="opacity:0.5; font-style:italic">Ingredient</span>`);
      // If note was used as name, don't show it again
      const finalNote = (note && !renderName) ? '' : renderNote;

      return html`
              <li>
                ${renderQuantity}
                ${finalName}
                ${finalNote}
              </li>
            `;
    })}
        </ul>
      </div>
    `;
  }

  protected handleImageError(e: Event): void {
    const img = e.target as HTMLImageElement;
    const container = img.parentElement;

    if (container) {
      container.remove();
    }
  }
}
