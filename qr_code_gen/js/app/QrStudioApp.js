/**
 * Wires the control panel to the generator, keeps the live preview in sync
 * and starts the downloads.
 */
class QrStudioApp {
  static PREVIEW_MAX_PIXELS = 1000;
  static RENDER_DELAY_MS = 100;
  static ELEMENT_IDS = [
    'content', 'errorCorrection', 'boostErrorCorrection', 'outputSize', 'quietZone',
    'moduleShape', 'eyeFrameShape', 'eyeBallShape',
    'foregroundType', 'foregroundColor', 'foregroundColorEnd', 'foregroundAngle', 'gradientControls',
    'backgroundColor', 'backgroundTransparent',
    'customEyeColors', 'eyeColorControls', 'eyeFrameColor', 'eyeBallColor',
    'logoFile', 'logoFileName', 'removeLogo', 'logoControls', 'logoSize', 'logoPadding',
    'logoBackdrop', 'logoBackdropColor', 'logoCornerRadius',
    'fileName', 'downloadPng', 'downloadJpg', 'downloadSvg',
    'preview', 'previewFrame', 'message', 'details', 'warnings',
  ];

  constructor(root = document) {
    this.root = root;
    this.elements = this.collectElements();
    this.formReader = new QrFormReader(this.elements);
    this.logo = null;
    this.currentDesign = null;
    this.renderTimer = null;
  }

  start() {
    this.fillShapeSelects();
    this.bindFormChanges();
    this.bindLogoControls();
    this.bindDownloadButtons();
    this.refreshConditionalControls();
    this.renderNow();
  }

  collectElements() {
    return QrStudioApp.ELEMENT_IDS.reduce((elements, id) => {
      elements[id] = this.root.getElementById(id);
      return elements;
    }, {});
  }

  // --- Setup --------------------------------------------------------------

  fillShapeSelects() {
    this.fillSelect(this.elements.moduleShape, MODULE_SHAPES);
    this.fillSelect(this.elements.eyeFrameShape, EYE_FRAME_SHAPES);
    this.fillSelect(this.elements.eyeBallShape, EYE_BALL_SHAPES);
  }

  fillSelect(selectElement, shapeRegistry) {
    selectElement.innerHTML = '';
    for (const { name, label } of shapeRegistry.listOptions()) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = label;
      selectElement.appendChild(option);
    }
    selectElement.value = shapeRegistry.defaultName;
  }

  bindFormChanges() {
    const form = this.root.getElementById('controls');
    form.addEventListener('input', () => {
      this.refreshConditionalControls();
      this.scheduleRender();
    });
    form.addEventListener('change', () => {
      this.refreshConditionalControls();
      this.scheduleRender();
    });
    form.addEventListener('submit', (event) => event.preventDefault());
  }

  bindLogoControls() {
    this.elements.logoFile.addEventListener('change', (event) => this.loadLogo(event.target.files[0]));
    this.elements.removeLogo.addEventListener('click', () => this.removeLogo());
  }

  bindDownloadButtons() {
    this.elements.downloadPng.addEventListener('click', () => this.runExport((exporter, name) => exporter.downloadPng(name)));
    this.elements.downloadJpg.addEventListener('click', () => this.runExport((exporter, name) => exporter.downloadJpg(name)));
    this.elements.downloadSvg.addEventListener('click', () => this.runExport((exporter, name) => exporter.downloadSvg(name)));
  }

  // --- Logo ---------------------------------------------------------------

  async loadLogo(file) {
    if (!file) {
      return;
    }
    try {
      this.logo = await LogoImageLoader.load(file);
      this.elements.logoFileName.textContent = this.logo.fileName;
      this.refreshConditionalControls();
      this.renderNow();
    } catch (error) {
      this.showMessage(error.message);
    }
  }

  removeLogo() {
    this.logo = null;
    this.elements.logoFile.value = '';
    this.elements.logoFileName.textContent = 'No logo selected';
    this.refreshConditionalControls();
    this.renderNow();
  }

  // --- Rendering ----------------------------------------------------------

  scheduleRender() {
    clearTimeout(this.renderTimer);
    this.renderTimer = setTimeout(() => this.renderNow(), QrStudioApp.RENDER_DELAY_MS);
  }

  renderNow() {
    const design = this.formReader.read(this.logo);

    if (design.text.trim().length === 0) {
      this.showEmptyState();
      return;
    }
    try {
      const matrix = QrCodeGenerator.generate(design.text, {
        errorCorrectionLevel: design.errorCorrectionLevel,
        boostErrorCorrection: design.boostErrorCorrection,
      });
      this.currentDesign = { ...design, matrix };
      this.paintPreview(matrix, design);
      this.showDetails(matrix, design);
      this.showWarnings(matrix, design);
      this.showMessage('');
      this.setDownloadsEnabled(true);
    } catch (error) {
      this.currentDesign = null;
      this.setDownloadsEnabled(false);
      this.showMessage(error.message);
    }
  }

  paintPreview(matrix, design) {
    const previewSize = Math.min(design.pixelSize, QrStudioApp.PREVIEW_MAX_PIXELS);
    new CanvasQrRenderer(design.renderOptions).render(this.elements.preview, matrix, previewSize);
    this.elements.previewFrame.classList.toggle('is-transparent', design.renderOptions.hasTransparentBackground);
  }

  showEmptyState() {
    this.currentDesign = null;
    this.setDownloadsEnabled(false);
    this.clearPreview();
    this.elements.details.textContent = '';
    this.elements.warnings.innerHTML = '';
    this.showMessage('Type a link or some text to generate your QR code.');
  }

  clearPreview() {
    const context = this.elements.preview.getContext('2d');
    context.clearRect(0, 0, this.elements.preview.width, this.elements.preview.height);
  }

  // --- Feedback -----------------------------------------------------------

  showDetails(matrix, design) {
    const totalModules = matrix.size + design.renderOptions.quietZoneModules * 2;
    const pixelsPerModule = (design.pixelSize / totalModules).toFixed(1);
    this.elements.details.textContent =
      `Version ${matrix.version} · ${matrix.size}×${matrix.size} modules · ` +
      `error correction ${matrix.errorCorrectionLevel.name} (${matrix.errorCorrectionLevel.label}, ` +
      `~${matrix.errorCorrectionLevel.recoveryPercentage}% recoverable) · ${matrix.mode.name} · ` +
      `export ${design.pixelSize}×${design.pixelSize} px (${pixelsPerModule} px per module)`;
  }

  showWarnings(matrix, design) {
    const warnings = ScanSafetyAdvisor.collectWarnings(matrix, design.renderOptions, design.pixelSize);
    this.elements.warnings.innerHTML = '';
    for (const warning of warnings) {
      const item = document.createElement('li');
      item.textContent = warning;
      this.elements.warnings.appendChild(item);
    }
  }

  showMessage(text) {
    this.elements.message.textContent = text;
    this.elements.message.hidden = text.length === 0;
  }

  setDownloadsEnabled(isEnabled) {
    for (const button of [this.elements.downloadPng, this.elements.downloadJpg, this.elements.downloadSvg]) {
      button.disabled = !isEnabled;
    }
  }

  /** Shows or hides the controls that only matter for the current choices. */
  refreshConditionalControls() {
    this.elements.gradientControls.hidden = this.elements.foregroundType.value !== 'gradient';
    this.elements.eyeColorControls.hidden = !this.elements.customEyeColors.checked;
    this.elements.logoControls.hidden = this.logo === null;
    this.elements.backgroundColor.disabled = this.elements.backgroundTransparent.checked;
    this.refreshRangeLabels();
  }

  refreshRangeLabels() {
    for (const label of this.root.querySelectorAll('[data-value-for]')) {
      const source = this.elements[label.dataset.valueFor];
      label.textContent = `${source.value}${label.dataset.suffix || ''}`;
    }
  }

  // --- Exporting ----------------------------------------------------------

  async runExport(action) {
    if (!this.currentDesign) {
      return;
    }
    const { matrix, renderOptions, pixelSize, fileName } = this.currentDesign;
    try {
      await action(new QrExporter(matrix, renderOptions, pixelSize), fileName);
    } catch (error) {
      this.showMessage(error.message);
    }
  }
}
