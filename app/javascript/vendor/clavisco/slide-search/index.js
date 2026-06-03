/**
 * @clavisco/slide-search - Slide search panel component
 * Mobile-friendly slide panel for search functionality
 * Replaces modal-based search with better mobile UX
 */

// Re-export the Stimulus controller
export { default as SlideSearchController } from './controllers/slide_search_controller.js'

// Export controller path for Stimulus registration
export const controllerPath = 'vendor/clavisco/slide-search/controllers/slide_search_controller'

export default {
  SlideSearchController
}
