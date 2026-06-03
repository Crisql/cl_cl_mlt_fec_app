import { Application } from '@hotwired/stimulus'

const application = Application.start()

// Configuración
application.debug = false
window.Stimulus = application

export { application }
