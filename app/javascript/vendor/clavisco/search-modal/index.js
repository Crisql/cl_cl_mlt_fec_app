/**
 * @clavisco/search-modal - Search modal component
 * Migrated from Angular to vanilla JavaScript for Rails/Stimulus
 */

// Re-export the Stimulus controller
export { default as SearchModalController } from './controllers/search_modal_controller.js'

// Export controller path for Stimulus registration
export const controllerPath = 'vendor/clavisco/search-modal/controllers/search_modal_controller'

export default {
  SearchModalController
}
