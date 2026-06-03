/**
 * @clavisco/menu - Menu component and service
 * Migrated from Angular to vanilla JavaScript for Rails/Stimulus
 */

import { Storage } from 'vendor/clavisco/core'
import { publish } from 'vendor/clavisco/linker'

// ============================================================
// MENU ITEM INTERFACE
// ============================================================

/**
 * @typedef {Object} IMenuItem
 * @property {number} Id - Menu item ID
 * @property {string} Name - Display name
 * @property {string} Icon - Material icon name
 * @property {string} Route - Navigation route
 * @property {boolean} IsActive - Active state
 * @property {IMenuItem[]} [Children] - Sub-menu items
 */

// ============================================================
// MENU SERVICE
// ============================================================

class MenuService {
  constructor() {
    this.menuItems = []
    this.activeItem = null
    this.isCollapsed = false
  }

  /**
   * Set menu items
   * @param {IMenuItem[]} items - Menu items array
   */
  setItems(items) {
    this.menuItems = items || []
    this.notifyChange()
  }

  /**
   * Get menu items
   * @returns {IMenuItem[]} Menu items
   */
  getItems() {
    return this.menuItems
  }

  /**
   * Set active menu item
   * @param {IMenuItem} item - Active item
   */
  setActiveItem(item) {
    this.activeItem = item
    this.notifyChange()
  }

  /**
   * Get active menu item
   * @returns {IMenuItem|null} Active item
   */
  getActiveItem() {
    return this.activeItem
  }

  /**
   * Toggle menu collapse state
   */
  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed
    this.notifyChange()
  }

  /**
   * Set collapse state
   * @param {boolean} collapsed - Collapsed state
   */
  setCollapsed(collapsed) {
    this.isCollapsed = collapsed
    this.notifyChange()
  }

  /**
   * Navigate to a menu item
   * @param {IMenuItem} item - Menu item to navigate to
   */
  navigate(item) {
    if (!item || !item.Route) return

    this.setActiveItem(item)

    // Publish navigation event via linker
    publish({
      View: 'menu',
      Target: 'navigate',
      Data: {
        route: item.Route,
        item: item
      }
    })

    // Use Turbo for navigation if available
    if (window.Turbo) {
      window.Turbo.visit(item.Route)
    } else {
      window.location.href = item.Route
    }
  }

  /**
   * Find menu item by route
   * @param {string} route - Route to find
   * @returns {IMenuItem|null} Found item
   */
  findByRoute(route) {
    const search = (items) => {
      for (const item of items) {
        if (item.Route === route) return item
        if (item.Children) {
          const found = search(item.Children)
          if (found) return found
        }
      }
      return null
    }
    return search(this.menuItems)
  }

  /**
   * Save menu state to storage
   */
  saveState() {
    Storage.set('menuState', {
      isCollapsed: this.isCollapsed,
      activeItemId: this.activeItem?.Id
    })
  }

  /**
   * Restore menu state from storage
   */
  restoreState() {
    const state = Storage.get('menuState')
    if (state) {
      this.isCollapsed = state.isCollapsed || false
      if (state.activeItemId) {
        const item = this.findById(state.activeItemId)
        if (item) this.activeItem = item
      }
    }
  }

  /**
   * Find menu item by ID
   * @param {number} id - Item ID
   * @returns {IMenuItem|null} Found item
   */
  findById(id) {
    const search = (items) => {
      for (const item of items) {
        if (item.Id === id) return item
        if (item.Children) {
          const found = search(item.Children)
          if (found) return found
        }
      }
      return null
    }
    return search(this.menuItems)
  }

  /**
   * Notify subscribers of menu changes
   */
  notifyChange() {
    document.dispatchEvent(new CustomEvent('cl-menu-change', {
      detail: {
        items: this.menuItems,
        activeItem: this.activeItem,
        isCollapsed: this.isCollapsed
      }
    }))
  }
}

// Singleton instance
const menu = new MenuService()

// ============================================================
// EXPORTS
// ============================================================

export const Menu = menu

export function setItems(items) {
  menu.setItems(items)
}

export function getItems() {
  return menu.getItems()
}

export function setActiveItem(item) {
  menu.setActiveItem(item)
}

export function getActiveItem() {
  return menu.getActiveItem()
}

export function toggleCollapse() {
  menu.toggleCollapse()
}

export function navigate(item) {
  menu.navigate(item)
}

export function findByRoute(route) {
  return menu.findByRoute(route)
}

export default {
  Menu,
  setItems,
  getItems,
  setActiveItem,
  getActiveItem,
  toggleCollapse,
  navigate,
  findByRoute
}
