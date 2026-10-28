/** The dropdown that chooses what the selected files become. */

export class TargetFormatView {
  #container;
  #onTargetFormatChosen;

  constructor({ container, onTargetFormatChosen }) {
    this.#container = container;
    this.#onTargetFormatChosen = onTargetFormatChosen;
  }

  /** Offer `targetFormats`, with `currentFormat` pre-selected. */
  showFormats(targetFormats, currentFormat, summaryText) {
    if (targetFormats.length === 0) {
      this.showMessage('These files have no conversion in common.');
      return;
    }
    const select = document.createElement('select');
    select.append(...targetFormats.map((format) => buildOption(format, currentFormat)));
    select.addEventListener('change', () => this.#onTargetFormatChosen(select.value));
    this.#container.replaceChildren(select, buildSummary(summaryText));
  }

  /** Replace the dropdown with a single explanatory line. */
  showMessage(message) {
    const hint = document.createElement('p');
    hint.className = 'card__hint';
    hint.textContent = message;
    this.#container.replaceChildren(hint);
  }
}

function buildOption(format, currentFormat) {
  const option = document.createElement('option');
  option.value = format;
  option.textContent = `.${format}`;
  option.selected = format === currentFormat;
  return option;
}

function buildSummary(summaryText) {
  const summary = document.createElement('p');
  summary.className = 'card__hint';
  summary.style.marginTop = '10px';
  summary.textContent = summaryText;
  return summary;
}
