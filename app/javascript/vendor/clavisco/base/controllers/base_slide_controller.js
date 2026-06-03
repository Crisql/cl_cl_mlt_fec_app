import { Controller } from "@hotwired/stimulus"

/**
 * BaseSlideController - Controlador base para slide panels
 *
 * Centraliza la funcionalidad común de todos los slide panels:
 * - Animaciones de apertura/cierre (translate-x)
 * - Gestión de backdrop y pointer-events
 * - Touch gestures para mobile (swipe right to close)
 * - Ajuste responsivo para sidebar (opcional)
 * - Manejo de ESC key
 *
 * @abstract
 * @extends Controller
 *
 * @requires targets: panel, backdrop
 * @optional values: adjustForElement (selector CSS), adjustElementWidth (px)
 *
 * @example
 * // En el controlador hijo:
 * import BaseSlideController from "vendor/clavisco/base/controllers/base_slide_controller"
 *
 * export default class extends BaseSlideController {
 *   static targets = [...BaseSlideController.targets, "customTarget"]
 *
 *   connect() {
 *     super.connect()
 *     // Lógica adicional
 *   }
 *
 *   // Override si necesitas personalizar
 *   onSlideOpened() {
 *     super.onSlideOpened()
 *     this.customInput?.focus()
 *   }
 * }
 */
export default class extends Controller {
  static targets = ["panel", "backdrop"]

  static values = {
    // Ajuste responsivo para sidebar (opcional)
    adjustForElement: { type: String, default: "" },      // Selector CSS del elemento a evitar (ej: sidebar)
    adjustElementWidth: { type: Number, default: 0 }      // Ancho del elemento en px
  }

  connect() {
    this.isOpen = false

    // Touch gesture tracking para mobile
    this.touchStartX = 0
    this.touchCurrentX = 0
    this.isDragging = false

    // Setup sidebar observer (solo si adjustForElement está configurado)
    this.setupAdjustmentObserver()
  }

  disconnect() {
    // Cleanup sidebar observer
    if (this.adjustmentObserver) {
      this.adjustmentObserver.disconnect()
    }
  }

  /**
   * Setup MutationObserver para detectar cambios en el elemento a ajustar (ej: sidebar toggle)
   * Solo se configura si adjustForElement está presente
   * @private
   */
  setupAdjustmentObserver() {
    // Solo si adjustForElement está configurado
    if (!this.adjustForElementValue) return

    const element = document.querySelector(this.adjustForElementValue)
    if (!element) return

    // Observer para detectar cambios de clase (ej: sidebar abierto/cerrado)
    this.adjustmentObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          // Solo re-ajustar si el slide está abierto
          if (this.isOpen) {
            this.adjustForElement()
          }
        }
      })
    })

    // Comenzar observación
    this.adjustmentObserver.observe(element, {
      attributes: true,
      attributeFilter: ['class']
    })
  }

  /**
   * Ajusta el ancho y posición del slide panel basado en el elemento configurado
   * Usado típicamente para evitar sobreposición con sidebar en desktop
   * @private
   */
  adjustForElement() {
    const isDesktop = window.innerWidth >= 1024
    if (!isDesktop) {
      // En mobile, siempre usar ancho completo
      this.panelTarget.style.maxWidth = ""
      this.backdropTarget.style.left = ""
      return
    }

    // Solo ajustar si está configurado
    if (!this.adjustForElementValue || !this.adjustElementWidthValue) {
      this.panelTarget.style.maxWidth = ""
      this.backdropTarget.style.left = ""
      return
    }

    // Buscar elemento configurado (ej: sidebar)
    const element = document.querySelector(this.adjustForElementValue)
    if (!element) {
      this.panelTarget.style.maxWidth = ""
      this.backdropTarget.style.left = ""
      return
    }

    // Verificar si el elemento está visible y ocupando espacio
    // Típicamente elementos con lg:relative están visibles en desktop
    const elementVisible = element.classList.contains("lg:relative")

    if (elementVisible) {
      // Elemento visible, reducir ancho disponible para el slide
      const elementWidth = this.adjustElementWidthValue
      const viewportWidth = window.innerWidth
      const availableWidth = viewportWidth - elementWidth

      // Aplicar max-width al panel
      this.panelTarget.style.maxWidth = `${availableWidth}px`

      // Backdrop debe empezar después del elemento
      this.backdropTarget.style.left = `${elementWidth}px`
    } else {
      // Elemento oculto, usar ancho completo
      this.panelTarget.style.maxWidth = ""
      this.backdropTarget.style.left = ""
    }
  }

  /**
   * Abre el slide panel con animación
   * Gestiona backdrop, pointer-events y scroll del body
   * Llama a onSlideOpened() al finalizar la animación
   */
  open() {
    this.isOpen = true

    // Ajustar ancho si está configurado (ej: sidebar)
    this.adjustForElement()

    // Mostrar backdrop primero (con pointer-events disabled durante animación)
    this.backdropTarget.classList.remove("hidden")
    this.backdropTarget.classList.remove("opacity-0")
    this.backdropTarget.classList.add("pointer-events-none")

    // Prevenir scroll del body
    document.body.classList.add("overflow-hidden")

    // Animar entrada del panel
    this.panelTarget.classList.remove("translate-x-full")
    this.panelTarget.classList.add("translate-x-0")
    // Habilitar pointer-events del panel inmediatamente
    this.panelTarget.classList.remove("pointer-events-none")

    // Habilitar pointer-events del backdrop después de la animación
    setTimeout(() => {
      if (this.isOpen) {
        this.backdropTarget.classList.remove("pointer-events-none")
      }
      // Hook para controladores hijos
      this.onSlideOpened()
    }, 300)
  }

  /**
   * Cierra el slide panel con animación
   * Restaura scroll del body y limpia estilos inline
   * Llama a onSlideClosed() al finalizar la animación
   */
  close() {
    if (!this.isOpen) return

    this.isOpen = false

    // Deshabilitar pointer-events inmediatamente para evitar clicks durante cierre
    this.backdropTarget.classList.add("pointer-events-none")
    this.panelTarget.classList.add("pointer-events-none")

    // Animar salida del panel
    this.panelTarget.classList.remove("translate-x-0")
    this.panelTarget.classList.add("translate-x-full")

    // Fade out del backdrop
    this.backdropTarget.classList.add("opacity-0")

    // Restaurar scroll y ocultar backdrop después de animación
    setTimeout(() => {
      if (!this.isOpen) {
        this.backdropTarget.classList.add("hidden")
        document.body.classList.remove("overflow-hidden")

        // Limpiar estilos inline aplicados por adjustForElement
        this.panelTarget.style.maxWidth = ""
        this.backdropTarget.style.left = ""

        // Hook para controladores hijos
        this.onSlideClosed()
      }
    }, 300)
  }

  /**
   * Hook: Llamado después de que el slide se abre completamente
   * Los controladores hijos pueden override para agregar lógica personalizada
   * (ej: focus en un input, cargar datos, etc.)
   */
  onSlideOpened() {
    // Override en controladores hijos si es necesario
  }

  /**
   * Hook: Llamado después de que el slide se cierra completamente
   * Los controladores hijos pueden override para limpiar estado
   * (ej: reset formularios, limpiar datos, etc.)
   */
  onSlideClosed() {
    // Override en controladores hijos si es necesario
  }

  /**
   * Maneja click en el backdrop - cierra el slide
   */
  onBackdropClick(event) {
    if (event.target === this.backdropTarget) {
      this.close()
    }
  }

  /**
   * Maneja tecla ESC - cierra el slide
   */
  onKeydown(event) {
    if (event.key === "Escape" && this.isOpen) {
      this.close()
    }
  }

  /**
   * Touch gesture: inicio del swipe
   */
  onTouchStart(event) {
    if (!this.isOpen) return
    this.touchStartX = event.touches[0].clientX
    this.touchCurrentX = this.touchStartX
    this.isDragging = true
  }

  /**
   * Touch gesture: movimiento durante swipe
   * Solo permite swipe hacia la derecha (cerrar)
   */
  onTouchMove(event) {
    if (!this.isDragging) return

    this.touchCurrentX = event.touches[0].clientX
    const deltaX = this.touchCurrentX - this.touchStartX

    // Solo permitir swipe hacia la derecha (cerrar)
    if (deltaX > 0) {
      const translateX = Math.min(deltaX, this.panelTarget.offsetWidth)
      this.panelTarget.style.transform = `translateX(${translateX}px)`
    }
  }

  /**
   * Touch gesture: fin del swipe
   * Si se hizo swipe más del 30% del ancho, cerrar
   */
  onTouchEnd(event) {
    if (!this.isDragging) return

    this.isDragging = false
    const deltaX = this.touchCurrentX - this.touchStartX

    // Resetear transform inline
    this.panelTarget.style.transform = ""

    // Si se hizo swipe más del 30% del ancho, cerrar
    if (deltaX > this.panelTarget.offsetWidth * 0.3) {
      this.close()
    } else {
      // Restaurar posición
      this.panelTarget.classList.add("translate-x-0")
    }
  }
}
