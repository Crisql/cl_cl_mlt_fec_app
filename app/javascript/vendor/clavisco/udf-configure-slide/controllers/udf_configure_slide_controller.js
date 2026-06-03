import BaseSlideController from "vendor/clavisco/base/controllers/base_slide_controller"

export default class UdfConfigureSlideController extends BaseSlideController {
  static targets = [
    ...BaseSlideController.targets,
    "name", "description", "type", "size", "isActive",
    "dataSource", "postTransactionObject", "group"
  ]

  static values = {
    ...BaseSlideController.values,
    udf: Object,
    otherUdfs: Array
  }

  connect() {
    super.connect()
    this._openListener = (e) => this.handleOpen(e.detail)
    window.addEventListener("udf-configure-slide:open", this._openListener)
  }

  disconnect() {
    window.removeEventListener("udf-configure-slide:open", this._openListener)
    super.disconnect()
  }

  handleOpen(detail) {
    this.udfValue = detail.udf || {}
    this.otherUdfsValue = detail.otherUdfs || []
    this.onSaveCallback = detail.onSave

    this.populateForm()
    this.open()
  }

  populateForm() {
    if (this.hasNameTarget) this.nameTarget.value = this.udfValue.Name || ""
    if (this.hasDescriptionTarget) this.descriptionTarget.value = this.udfValue.Description || ""
    if (this.hasTypeTarget) this.typeTarget.value = this.udfValue.Type || ""
    if (this.hasSizeTarget) this.sizeTarget.value = this.udfValue.Size || ""
    if (this.hasIsActiveTarget) this.isActiveTarget.checked = !!this.udfValue.IsActive
  }

  save() {
    const configuredUdf = {
      ...this.udfValue,
      IsActive: this.isActiveTarget?.checked || false,
      DataSource: this.dataSourceTarget?.value || null,
      PostTransactionObject: this.postTransactionObjectTarget?.value || null,
      Group: this.groupTarget?.value || null
    }

    if (this.onSaveCallback) {
      this.onSaveCallback(configuredUdf)
    }

    this.close()
  }
}
