import { Controller } from "@hotwired/stimulus"

/**
 * Action Buttons Controller
 *
 * A reusable, flexible button bar component that manages action buttons at the top of pages.
 * Replaces Angular app-action-buttons component.
 *
 * Features:
 * - Simple buttons and dropdown menus
 * - Dynamic enable/disable based on form validity or permissions
 * - Tailwind color variants (green, blue, orange, gray)
 * - SVG icons for common actions
 * - Custom event dispatch for button clicks
 * - Dynamic button state updates
 *
 * Usage:
 * <div data-controller="action-buttons"
 *      data-action-buttons-buttons-value='[...]'>
 * </div>
 *
 * Listen for events:
 * document.addEventListener("action-button:clicked", (e) => {
 *   console.log(e.detail.key) // Button key
 * })
 *
 * Update button states:
 * document.dispatchEvent(new CustomEvent("action-buttons:update", {
 *   detail: { SAVE: { disabled: false }, PRINT: { disabled: true } }
 * }))
 */
export default class extends Controller {
  static targets = [
    "buttonsContainer",
    "dropdown"
  ]

  static values = {
    buttons: String // JSON string of button configurations
  }

  connect() {
    this.parseButtonsConfig()
    this.renderButtons()
    this.setupEventListeners()
  }

  disconnect() {
    this.removeEventListeners()
  }

  /**
   * Parse the buttons configuration from the value attribute
   */
  parseButtonsConfig() {
    try {
      this.buttonsConfig = this.buttonsValue ? JSON.parse(this.buttonsValue) : []
    } catch (error) {
      console.error("Failed to parse buttons config:", error)
      this.buttonsConfig = []
    }
  }

  /**
   * Setup global event listeners
   */
  setupEventListeners() {
    this.boundUpdateButtons = this.handleUpdateEvent.bind(this)
    document.addEventListener("action-buttons:update", this.boundUpdateButtons)

    // Close dropdowns when clicking outside
    this.boundClickOutside = this.handleClickOutside.bind(this)
    document.addEventListener("click", this.boundClickOutside, true)
  }

  /**
   * Remove global event listeners
   */
  removeEventListeners() {
    document.removeEventListener("action-buttons:update", this.boundUpdateButtons)
    document.removeEventListener("click", this.boundClickOutside, true)
  }

  /**
   * Handle external update event for button states
   * detail: { KEY: { disabled: boolean }, ... }
   */
  handleUpdateEvent(event) {
    if (!event?.detail) return

    const updates = event.detail
    Object.entries(updates).forEach(([key, state]) => {
      const button = this.buttonsConfig.find(b => b.key === key)
      if (button) {
        if (state.disabled !== undefined) {
          button.disabled = state.disabled
        }
      }
    })

    this.renderButtons()
  }

  /**
   * Handle click outside dropdowns to close them
   */
  handleClickOutside(event) {
    if (!this.element.contains(event.target)) {
      this.closeAllDropdowns()
    }
  }

  /**
   * Render all buttons
   */
  renderButtons() {
    const container = this.buttonsContainerTarget
    container.innerHTML = ""

    this.buttonsConfig.forEach(buttonConfig => {
      const buttonEl = this.createButtonElement(buttonConfig)
      container.appendChild(buttonEl)
    })
  }

  /**
   * Create a button element (simple or with dropdown)
   */
  createButtonElement(config) {
    const wrapper = document.createElement("div")
    wrapper.className = "relative"
    wrapper.dataset.buttonKey = config.key

    // Main button
    const button = document.createElement("button")
    button.type = "button"
    button.className = this.getButtonClasses(config)
    button.disabled = config.disabled || false

    // Button content
    const content = document.createElement("span")
    content.className = "flex items-center gap-2"

    // Icon
    if (config.icon) {
      const icon = this.createIcon(config.icon)
      content.appendChild(icon)
    }

    // Text
    if (config.text) {
      const text = document.createElement("span")
      text.textContent = config.text
      content.appendChild(text)
    }

    button.appendChild(content)

    // Add click handler
    button.addEventListener("click", (e) => {
      if (config.options && config.options.length > 0) {
        e.preventDefault()
        this.toggleDropdown(e)
      } else {
        this.handleButtonClick(config)
      }
    })

    wrapper.appendChild(button)

    // Add dropdown menu if button has options
    if (config.options && config.options.length > 0) {
      const dropdown = this.createDropdownMenu(config)
      wrapper.appendChild(dropdown)
    }

    return wrapper
  }

  /**
   * Get button classes based on configuration
   */
  getButtonClasses(config) {
    const baseClasses = "px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 whitespace-nowrap"
    const colorClasses = this.getColorClasses(config.color || "gray", config.disabled)
    const disabledClasses = config.disabled ? "opacity-50 cursor-not-allowed" : ""

    return `${baseClasses} ${colorClasses} ${disabledClasses}`
  }

  /**
   * Get color-specific Tailwind classes
   */
  getColorClasses(color, disabled) {
    const colors = {
      green: disabled
        ? "bg-green-50 text-green-600 border border-green-200"
        : "bg-green-600 text-white hover:bg-green-700 active:bg-green-800 shadow-sm hover:shadow-md",
      blue: disabled
        ? "bg-blue-50 text-blue-600 border border-blue-200"
        : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm hover:shadow-md",
      orange: disabled
        ? "bg-orange-50 text-orange-600 border border-orange-200"
        : "bg-orange-600 text-white hover:bg-orange-700 active:bg-orange-800 shadow-sm hover:shadow-md",
      gray: disabled
        ? "bg-gray-100 text-gray-400 border border-gray-200"
        : "bg-gray-600 text-white hover:bg-gray-700 active:bg-gray-800 shadow-sm hover:shadow-md",
      red: disabled
        ? "bg-red-50 text-red-600 border border-red-200"
        : "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm hover:shadow-md"
    }

    return colors[color] || colors.gray
  }

  /**
   * Create SVG icon element
   */
  createIcon(iconName) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("width", "20")
    svg.setAttribute("height", "20")
    svg.setAttribute("viewBox", "0 0 24 24")
    svg.setAttribute("fill", "none")
    svg.setAttribute("stroke", "currentColor")
    svg.setAttribute("stroke-width", "2")
    svg.setAttribute("stroke-linecap", "round")
    svg.setAttribute("stroke-linejoin", "round")
    svg.classList.add("icon")

    const iconPaths = {
      save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline>',
      print: '<polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect>',
      clear: '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
      search: '<circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path>',
      edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>',
      delete: '<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>',
      copy: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>',
      download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><polyline points="12 15 12 3"></polyline>',
      upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 4 12 9 7 4"></polyline><line x1="12" y1="9" x2="12" y2="21"></line>',
      settings: '<circle cx="12" cy="12" r="3"></circle><path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m2.12 2.12l4.24 4.24M1 12h6m6 0h6m-1.78 7.78l-4.24-4.24m-2.12-2.12l-4.24-4.24"></path>',
      more: '<circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle>'
    }

    svg.innerHTML = iconPaths[iconName] || iconPaths.more
    return svg
  }

  /**
   * Create dropdown menu for a button with options
   */
  createDropdownMenu(config) {
    const dropdown = document.createElement("div")
    dropdown.className = "hidden absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-max"
    dropdown.dataset.dropdown = config.key

    config.options.forEach(option => {
      const item = document.createElement("button")
      item.type = "button"
      item.className = "w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700 flex items-center gap-2 first:rounded-t-lg last:rounded-b-lg transition-colors"

      const itemContent = document.createElement("span")
      itemContent.className = "flex items-center gap-2 w-full"

      if (option.icon) {
        const icon = this.createIcon(option.icon)
        itemContent.appendChild(icon)
      }

      const text = document.createElement("span")
      text.textContent = option.text || option.key
      itemContent.appendChild(text)

      item.appendChild(itemContent)

      item.addEventListener("click", (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.handleDropdownOptionClick(config.key, option)
        this.closeAllDropdowns()
      })

      dropdown.appendChild(item)
    })

    return dropdown
  }

  /**
   * Toggle dropdown visibility
   */
  toggleDropdown(event) {
    event.preventDefault()
    event.stopPropagation()

    const button = event.currentTarget
    const wrapper = button.closest("[data-button-key]")
    const dropdown = wrapper.querySelector("[data-dropdown]")

    if (!dropdown) return

    const isOpen = !dropdown.classList.contains("hidden")

    this.closeAllDropdowns()

    if (!isOpen) {
      dropdown.classList.remove("hidden")
    }
  }

  /**
   * Close all open dropdowns
   */
  closeAllDropdowns() {
    const dropdowns = this.element.querySelectorAll("[data-dropdown]")
    dropdowns.forEach(dropdown => {
      dropdown.classList.add("hidden")
    })
  }

  /**
   * Handle regular button click
   */
  handleButtonClick(config) {
    if (config.disabled) return

    const event = new CustomEvent("action-button:clicked", {
      detail: { key: config.key, config },
      bubbles: true,
      cancelable: true
    })

    this.element.dispatchEvent(event)
  }

  /**
   * Handle dropdown option click
   */
  handleDropdownOptionClick(buttonKey, option) {
    const event = new CustomEvent("action-button:clicked", {
      detail: {
        key: buttonKey,
        optionKey: option.key,
        option,
        isDropdownOption: true
      },
      bubbles: true,
      cancelable: true
    })

    this.element.dispatchEvent(event)
  }

  /**
   * Public method to update button states dynamically
   * @param {Object} updates - { KEY: { disabled: boolean }, ... }
   */
  updateButtons(updates) {
    this.handleUpdateEvent({ detail: updates })
  }

  /**
   * Public method to get current button configuration
   */
  getButtons() {
    return this.buttonsConfig
  }

  /**
   * Public method to get a specific button configuration
   */
  getButton(key) {
    return this.buttonsConfig.find(b => b.key === key)
  }

  /**
   * Public method to add or replace a button
   */
  addButton(buttonConfig) {
    const index = this.buttonsConfig.findIndex(b => b.key === buttonConfig.key)
    if (index > -1) {
      this.buttonsConfig[index] = buttonConfig
    } else {
      this.buttonsConfig.push(buttonConfig)
    }
    this.renderButtons()
  }

  /**
   * Public method to remove a button
   */
  removeButton(key) {
    this.buttonsConfig = this.buttonsConfig.filter(b => b.key !== key)
    this.renderButtons()
  }

  /**
   * Public method to clear all buttons
   */
  clearButtons() {
    this.buttonsConfig = []
    this.renderButtons()
  }
}
