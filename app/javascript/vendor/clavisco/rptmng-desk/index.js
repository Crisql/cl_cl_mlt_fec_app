/**
 * @clavisco/rptmng-desk - Report management desk component
 * Migrated from Angular to Rails + Stimulus
 *
 * This module provides a complete report viewer/desk UI for selecting,
 * configuring, and managing report generation, download, print, preview,
 * and email functionality.
 *
 * Usage:
 * 1. Register the controller in your Stimulus application:
 *    import RptmngDeskController from "vendor/clavisco/rptmng-desk"
 *    application.register("rptmng-desk", RptmngDeskController)
 *
 * 2. Use the partial in your views:
 *    <%= render 'shared/rptmng_desk', module_name: 'sales' %>
 */

export { default as RptmngDeskController } from './controllers/rptmng_desk_controller'

// Re-export ReportManager for convenience
export { ReportManager, generateReport, downloadReport, printReport, previewReport, sendByEmail } from 'vendor/clavisco/rptmng-menu'
