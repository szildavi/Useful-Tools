/** A dialog listing every conversion the browser can and cannot perform. */

export class FormatsDialog {
  #dialog;
  #body;
  #registry;

  constructor({ dialog, body, closeButton, registry }) {
    this.#dialog = dialog;
    this.#body = body;
    this.#registry = registry;
    closeButton.addEventListener('click', () => this.#dialog.close());
  }

  /** Render the current capabilities and show the dialog. */
  open() {
    this.#body.replaceChildren(...this.#buildConverterSections());
    this.#dialog.showModal();
  }

  #buildConverterSections() {
    return this.#registry.conversionCountsByConverter().map(({ converter, count }) =>
      buildConverterSection(converter, count, this.#registry),
    );
  }
}

function buildConverterSection(converter, conversionCount, registry) {
  const section = document.createElement('section');
  section.className = 'format-group';
  section.append(
    buildTitle(converter),
    buildMeta(converter, conversionCount),
    buildFormatChips(converter, registry),
  );
  return section;
}

function buildTitle(converter) {
  const title = document.createElement('h3');
  title.className = 'format-group__title';
  title.textContent = converter.displayName;
  return title;
}

function buildMeta(converter, conversionCount) {
  const meta = document.createElement('p');
  meta.className = 'format-group__meta';
  meta.textContent = converter.isAvailable()
    ? `${conversionCount} conversions available`
    : `Unavailable - this browser is missing ${converter.missingCapabilities().join(', ')}`;
  return meta;
}

/** Show every format this converter reads, greyed out when unsupported. */
function buildFormatChips(converter, registry) {
  const list = document.createElement('div');
  list.className = 'format-group__list';
  const sourceFormats = [
    ...new Set(converter.supportedConversionPairs().map(([source]) => source)),
  ].sort();
  for (const sourceFormat of sourceFormats) {
    list.append(buildChip(sourceFormat, converter, registry));
  }
  return list;
}

function buildChip(sourceFormat, converter, registry) {
  const chip = document.createElement('span');
  chip.className = converter.isAvailable() ? 'format-chip' : 'format-chip format-chip--unavailable';
  chip.textContent = `.${sourceFormat}`;
  const targets = registry.targetFormatsFor(sourceFormat, { onlyAvailable: false });
  chip.title = `.${sourceFormat} → ${targets.map((target) => `.${target}`).join(', ')}`;
  return chip;
}
