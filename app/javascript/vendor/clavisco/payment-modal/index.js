/**
 * @clavisco/payment-modal - Payment modal component
 * Migrated from Angular to vanilla JavaScript for Rails/Stimulus
 */

// Re-export the Stimulus controller
export { default as PaymentModalController } from './controllers/payment_modal_controller.js'

// Export controller path for Stimulus registration
export const controllerPath = 'vendor/clavisco/payment-modal/controllers/payment_modal_controller'

export default {
  PaymentModalController
}
