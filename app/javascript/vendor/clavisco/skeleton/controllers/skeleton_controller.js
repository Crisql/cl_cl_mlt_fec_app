import { Controller } from "@hotwired/stimulus"

// Replicates @clavisco/skeleton - Loading skeleton placeholders
export default class extends Controller {
  static targets = ["container"]
  static values = {
    rows: { type: Number, default: 5 },
    columns: { type: Number, default: 4 },
    type: { type: String, default: "table" }
  }

  connect() {
    // Listen for skeleton show/hide events
    document.addEventListener("skeleton:show", this.handleShow.bind(this))
    document.addEventListener("skeleton:hide", this.handleHide.bind(this))

    // Render skeleton on connect if container is present
    if (this.hasContainerTarget) {
      this.render()
    }
  }

  disconnect() {
    document.removeEventListener("skeleton:show", this.handleShow.bind(this))
    document.removeEventListener("skeleton:hide", this.handleHide.bind(this))
  }

  // Handle external skeleton:show event
  handleShow(event) {
    if (event.detail?.target === this.element || !event.detail?.target) {
      this.show()
    }
  }

  // Handle external skeleton:hide event
  handleHide(event) {
    if (event.detail?.target === this.element || !event.detail?.target) {
      this.hide()
    }
  }

  // Show the skeleton loader
  show() {
    if (this.hasContainerTarget) {
      this.containerTarget.classList.remove("hidden")
    }
  }

  // Hide the skeleton loader
  hide() {
    if (this.hasContainerTarget) {
      this.containerTarget.classList.add("hidden")
    }
  }

  // Render the skeleton based on type
  render() {
    if (!this.hasContainerTarget) return

    const { rows, columns, type } = this

    let skeleton = ""
    switch (type) {
      case "table":
        skeleton = this.renderTableSkeleton(rows, columns)
        break
      case "list":
        skeleton = this.renderListSkeleton(rows)
        break
      case "card":
        skeleton = this.renderCardSkeleton()
        break
      default:
        skeleton = this.renderTableSkeleton(rows, columns)
    }

    this.containerTarget.innerHTML = skeleton
  }

  // Table skeleton: simulates table with headers and rows
  renderTableSkeleton(rows, columns) {
    const headerCells = Array.from({ length: columns })
      .map(
        () =>
          `<th class="px-4 py-3 text-left">
            <div class="h-4 bg-gray-200 rounded animate-pulse"></div>
          </th>`
      )
      .join("")

    const bodyCells = Array.from({ length: columns })
      .map(
        () =>
          `<td class="px-4 py-3">
            <div class="h-4 bg-gray-200 rounded animate-pulse"></div>
          </td>`
      )
      .join("")

    const bodyRows = Array.from({ length: rows })
      .map(
        () =>
          `<tr class="border-b border-gray-200 hover:bg-gray-50">
            ${bodyCells}
          </tr>`
      )
      .join("")

    return `
      <div class="w-full overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr class="border-b border-gray-200">
              ${headerCells}
            </tr>
          </thead>
          <tbody>
            ${bodyRows}
          </tbody>
        </table>
      </div>
    `
  }

  // List skeleton: simulates vertical list with avatar + text lines
  renderListSkeleton(rows) {
    const items = Array.from({ length: rows })
      .map(
        () => `
          <div class="flex items-center space-x-4 p-4 border-b border-gray-200 last:border-b-0">
            <!-- Avatar circle -->
            <div class="flex-shrink-0">
              <div class="w-12 h-12 bg-gray-200 rounded-full animate-pulse"></div>
            </div>
            <!-- Text content -->
            <div class="flex-1 space-y-2">
              <div class="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
              <div class="h-3 bg-gray-200 rounded animate-pulse w-1/2"></div>
            </div>
            <!-- Action button placeholder -->
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
        `
      )
      .join("")

    return `
      <div class="w-full divide-y divide-gray-200 rounded-lg border border-gray-200">
        ${items}
      </div>
    `
  }

  // Card skeleton: simulates rectangular card with image and text
  renderCardSkeleton() {
    return `
      <div class="w-full max-w-sm bg-white rounded-lg border border-gray-200 overflow-hidden">
        <!-- Image placeholder -->
        <div class="w-full h-48 bg-gray-200 animate-pulse"></div>

        <!-- Content -->
        <div class="p-4 space-y-3">
          <!-- Title -->
          <div class="h-5 bg-gray-200 rounded animate-pulse w-3/4"></div>

          <!-- Description lines -->
          <div class="space-y-2">
            <div class="h-3 bg-gray-200 rounded animate-pulse w-full"></div>
            <div class="h-3 bg-gray-200 rounded animate-pulse w-5/6"></div>
            <div class="h-3 bg-gray-200 rounded animate-pulse w-4/5"></div>
          </div>

          <!-- Footer buttons -->
          <div class="flex space-x-2 pt-2">
            <div class="flex-1 h-8 bg-gray-200 rounded animate-pulse"></div>
            <div class="flex-1 h-8 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    `
  }
}
