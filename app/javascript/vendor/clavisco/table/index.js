/**
 * @clavisco/table - Data table component
 * Migrated from Angular to vanilla JavaScript for Rails/Stimulus
 */

// Re-export the Stimulus controller
export { default as TableController } from './controllers/table_controller.js'

// Export controller path for Stimulus registration
export const controllerPath = 'vendor/clavisco/table/controllers/table_controller'

export default {
  TableController
}
