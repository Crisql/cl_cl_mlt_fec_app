import { Controller } from "@hotwired/stimulus"
import { getAPIHeaders } from "lib/api_helpers"

// Payment modal controller - replicates @clavisco/payment-modal
export default class extends Controller {
  static targets = [
    "modal", "docTotal", "balance", "change",
    "cashAmount", "cardAmount", "transferAmount", "creditAmount",
    "cardNumber", "cardAuth", "cardTerminal",
    "transferRef", "transferBank",
    "creditDays", "creditDueDate",
    "paymentsList"
  ]
  static values = {
    docTotal: { type: Number, default: 0 },
    payments: { type: Array, default: [] },
    terminals: { type: Array, default: [] },
    banks: { type: Array, default: [] },
    currency: { type: String, default: "USD" },
    allowPartial: { type: Boolean, default: false },
    allowCredit: { type: Boolean, default: true }
  }

  connect() {
    this.loadConfiguration()

    // Listen for open events on window (to catch events from any controller)
    this.boundOpen = this.handleOpenEvent.bind(this)
    window.addEventListener("payment-modal:open", this.boundOpen)
  }

  disconnect() {
    window.removeEventListener("payment-modal:open", this.boundOpen)
  }

  // Handle open event from other controllers
  handleOpenEvent(event) {
    if (event?.detail) {
      const { docTotal, currency, allowPartial, allowCredit } = event.detail

      // Update values from event
      if (allowPartial !== undefined) this.allowPartialValue = allowPartial
      if (allowCredit !== undefined) this.allowCreditValue = allowCredit

      // Open modal
      this.open(docTotal || 0, currency || "USD")
    }
  }

  async loadConfiguration() {
    try {
      // Load terminals
      const terminalsResponse = await fetch("/api/terminals", {
        headers: getAPIHeaders({
          successDescription: "Terminales obtenidos",
          errorDescription: "No se pudo obtener terminales"
        })
      })
      if (terminalsResponse.ok) {
        const data = await terminalsResponse.json()
        this.terminalsValue = data.Data || []
        this.populateTerminals()
      }

      // Load banks
      const banksResponse = await fetch("/api/banks", {
        headers: getAPIHeaders({
          successDescription: "Bancos obtenidos",
          errorDescription: "No se pudo obtener bancos"
        })
      })
      if (banksResponse.ok) {
        const data = await banksResponse.json()
        this.banksValue = data.Data || []
        this.populateBanks()
      }
    } catch (error) {
      console.error("Error loading payment config:", error)
    }
  }

  populateTerminals() {
    if (!this.hasCardTerminalTarget) return

    const options = this.terminalsValue.map(t =>
      `<option value="${t.Id}">${t.Description}</option>`
    ).join("")
    this.cardTerminalTarget.innerHTML = `<option value="">Seleccionar terminal</option>${options}`
  }

  populateBanks() {
    if (!this.hasTransferBankTarget) return

    const options = this.banksValue.map(b =>
      `<option value="${b.Code}">${b.Name}</option>`
    ).join("")
    this.transferBankTarget.innerHTML = `<option value="">Seleccionar banco</option>${options}`
  }

  open(docTotal = 0, currency = "USD") {
    this.docTotalValue = docTotal
    this.currencyValue = currency
    this.paymentsValue = []

    this.updateDisplay()

    if (this.hasModalTarget) {
      this.modalTarget.classList.remove("hidden")
    }
  }

  close() {
    if (this.hasModalTarget) {
      this.modalTarget.classList.add("hidden")
    }
    this.clearForm()
  }

  // Handle escape key
  onKeydown(event) {
    if (event.key === "Escape") {
      this.close()
    }
  }

  updateDisplay() {
    const totalPaid = this.calculateTotalPaid()
    const balance = this.docTotalValue - totalPaid
    const change = Math.max(0, totalPaid - this.docTotalValue)

    if (this.hasDocTotalTarget) {
      this.docTotalTarget.textContent = this.formatCurrency(this.docTotalValue)
    }
    if (this.hasBalanceTarget) {
      this.balanceTarget.textContent = this.formatCurrency(Math.max(0, balance))
      this.balanceTarget.classList.toggle("text-red-600", balance > 0)
      this.balanceTarget.classList.toggle("text-green-600", balance <= 0)
    }
    if (this.hasChangeTarget) {
      this.changeTarget.textContent = this.formatCurrency(change)
      this.changeTarget.parentElement.classList.toggle("hidden", change === 0)
    }

    this.renderPaymentsList()
  }

  calculateTotalPaid() {
    return this.paymentsValue.reduce((sum, p) => sum + (p.amount || 0), 0)
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: this.currencyValue
    }).format(amount)
  }

  renderPaymentsList() {
    if (!this.hasPaymentsListTarget) return

    if (this.paymentsValue.length === 0) {
      this.paymentsListTarget.innerHTML = '<p class="text-gray-500 text-center py-4">No hay pagos agregados</p>'
      return
    }

    const typeLabels = {
      cash: "Efectivo",
      card: "Tarjeta",
      transfer: "Transferencia",
      credit: "Crédito"
    }

    const rows = this.paymentsValue.map((payment, idx) => `
      <div class="flex items-center justify-between py-2 border-b">
        <div>
          <span class="font-medium">${typeLabels[payment.type]}</span>
          ${payment.reference ? `<span class="text-sm text-gray-500 ml-2">(${payment.reference})</span>` : ""}
        </div>
        <div class="flex items-center gap-2">
          <span class="font-semibold">${this.formatCurrency(payment.amount)}</span>
          <button type="button"
                  class="text-red-600 hover:text-red-800"
                  data-action="click->payment-modal#removePayment"
                  data-idx="${idx}">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
    `).join("")

    this.paymentsListTarget.innerHTML = rows
  }

  addCashPayment() {
    const amount = parseFloat(this.cashAmountTarget?.value || 0)
    if (amount <= 0) {
      this.dispatch("error", { detail: { message: "Ingrese un monto válido" } })
      return
    }

    this.paymentsValue = [
      ...this.paymentsValue,
      { type: "cash", amount }
    ]

    if (this.hasCashAmountTarget) this.cashAmountTarget.value = ""
    this.updateDisplay()
  }

  addCardPayment() {
    const amount = parseFloat(this.cardAmountTarget?.value || 0)
    const cardNumber = this.cardNumberTarget?.value || ""
    const authCode = this.cardAuthTarget?.value || ""
    const terminal = this.cardTerminalTarget?.value || ""

    if (amount <= 0) {
      this.dispatch("error", { detail: { message: "Ingrese un monto válido" } })
      return
    }

    this.paymentsValue = [
      ...this.paymentsValue,
      {
        type: "card",
        amount,
        cardNumber: cardNumber.slice(-4),
        authCode,
        terminal,
        reference: authCode || cardNumber.slice(-4)
      }
    ]

    // Clear card fields
    if (this.hasCardAmountTarget) this.cardAmountTarget.value = ""
    if (this.hasCardNumberTarget) this.cardNumberTarget.value = ""
    if (this.hasCardAuthTarget) this.cardAuthTarget.value = ""

    this.updateDisplay()
  }

  addTransferPayment() {
    const amount = parseFloat(this.transferAmountTarget?.value || 0)
    const reference = this.transferRefTarget?.value || ""
    const bank = this.transferBankTarget?.value || ""

    if (amount <= 0) {
      this.dispatch("error", { detail: { message: "Ingrese un monto válido" } })
      return
    }

    this.paymentsValue = [
      ...this.paymentsValue,
      {
        type: "transfer",
        amount,
        reference,
        bank
      }
    ]

    // Clear transfer fields
    if (this.hasTransferAmountTarget) this.transferAmountTarget.value = ""
    if (this.hasTransferRefTarget) this.transferRefTarget.value = ""

    this.updateDisplay()
  }

  addCreditPayment() {
    if (!this.allowCreditValue) {
      this.dispatch("error", { detail: { message: "Crédito no permitido" } })
      return
    }

    const balance = this.docTotalValue - this.calculateTotalPaid()
    if (balance <= 0) {
      this.dispatch("error", { detail: { message: "No hay saldo pendiente" } })
      return
    }

    const days = parseInt(this.creditDaysTarget?.value || 30)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + days)

    this.paymentsValue = [
      ...this.paymentsValue,
      {
        type: "credit",
        amount: balance,
        days,
        dueDate: dueDate.toISOString().split("T")[0],
        reference: `${days} días`
      }
    ]

    this.updateDisplay()
  }

  removePayment(event) {
    const idx = parseInt(event.currentTarget.dataset.idx)
    this.paymentsValue = this.paymentsValue.filter((_, i) => i !== idx)
    this.updateDisplay()
  }

  fillWithCash() {
    const balance = this.docTotalValue - this.calculateTotalPaid()
    if (balance > 0 && this.hasCashAmountTarget) {
      this.cashAmountTarget.value = balance.toFixed(2)
    }
  }

  confirm() {
    const totalPaid = this.calculateTotalPaid()
    const balance = this.docTotalValue - totalPaid

    if (balance > 0 && !this.allowPartialValue) {
      this.dispatch("error", { detail: { message: "El pago debe cubrir el total del documento" } })
      return
    }

    // Calculate change for cash payments
    const cashPayments = this.paymentsValue.filter(p => p.type === "cash")
    const totalCash = cashPayments.reduce((sum, p) => sum + p.amount, 0)
    const change = Math.max(0, totalPaid - this.docTotalValue)

    // Dispatch confirmation event with payment details
    this.dispatch("confirm", {
      detail: {
        docTotal: this.docTotalValue,
        totalPaid,
        change,
        payments: this.paymentsValue,
        balance: Math.max(0, balance)
      }
    })

    this.close()
  }

  clearForm() {
    this.paymentsValue = []
    if (this.hasCashAmountTarget) this.cashAmountTarget.value = ""
    if (this.hasCardAmountTarget) this.cardAmountTarget.value = ""
    if (this.hasCardNumberTarget) this.cardNumberTarget.value = ""
    if (this.hasCardAuthTarget) this.cardAuthTarget.value = ""
    if (this.hasTransferAmountTarget) this.transferAmountTarget.value = ""
    if (this.hasTransferRefTarget) this.transferRefTarget.value = ""
    if (this.hasCreditDaysTarget) this.creditDaysTarget.value = "30"
    this.updateDisplay()
  }

  // PinPad integration
  async processPinPad() {
    const amount = parseFloat(this.cardAmountTarget?.value || 0)
    const terminal = this.cardTerminalTarget?.value

    if (amount <= 0 || !terminal) {
      this.dispatch("error", { detail: { message: "Ingrese monto y seleccione terminal" } })
      return
    }

    document.dispatchEvent(new CustomEvent("overlay:show", { detail: { message: "Procesando pago con tarjeta..." }, bubbles: true }))

    try {
      const response = await fetch("/api/pinpad/process", {
        method: "POST",
        headers: {
          ...getAPIHeaders({
            successDescription: "Pago procesado",
            errorDescription: "Error al procesar pago"
          }),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount,
          terminalId: terminal,
          transactionType: "Sale"
        })
      })

      if (response.ok) {
        const result = await response.json()

        // Add the payment with PinPad response data
        this.paymentsValue = [
          ...this.paymentsValue,
          {
            type: "card",
            amount,
            authCode: result.Data?.AuthorizationCode,
            reference: result.Data?.AuthorizationCode,
            terminal,
            pinpadResponse: result.Data
          }
        ]

        // Clear card fields
        if (this.hasCardAmountTarget) this.cardAmountTarget.value = ""
        this.updateDisplay()

        this.dispatch("success", { detail: { message: "Pago procesado correctamente" } })
      } else {
        const error = await response.json()
        this.dispatch("error", { detail: { message: error.Message || error.message || "Error al procesar pago" } })
      }
    } catch (error) {
      console.error("PinPad error:", error)
      this.dispatch("error", { detail: { message: "Error de comunicación con el PinPad" } })
    } finally {
      document.dispatchEvent(new CustomEvent("overlay:hide", { bubbles: true }))
    }
  }
}
