/** Renders a conversion's options as form controls and reports every edit. */

import { OptionKind, coerceOptionValue } from '../core/conversion-option.js';

export class OptionsView {
  #container;
  #onOptionsChanged;
  #shownOptions = [];

  constructor({ container, onOptionsChanged }) {
    this.#container = container;
    this.#onOptionsChanged = onOptionsChanged;
  }

  /** Replace the panel's contents with controls for `options`. */
  showOptions(options, currentValues) {
    this.#shownOptions = options;
    if (options.length === 0) {
      this.showMessage('This conversion has no extra settings.');
      return;
    }
    this.#container.replaceChildren(
      ...options.map((option) => this.#buildField(option, currentValues[option.key])),
    );
  }

  /** Replace the panel's contents with a single explanatory line. */
  showMessage(message) {
    this.#shownOptions = [];
    const hint = document.createElement('p');
    hint.className = 'card__hint';
    hint.textContent = message;
    this.#container.replaceChildren(hint);
  }

  /** Return the value currently shown for every option. */
  collectValues() {
    return Object.fromEntries(
      this.#shownOptions.map((option) => [option.key, this.#readValue(option)]),
    );
  }

  #readValue(option) {
    const control = this.#container.querySelector(`[data-option-key="${option.key}"]`);
    if (!control) {
      return option.default;
    }
    const raw = option.kind === OptionKind.TOGGLE ? control.checked : control.value;
    return coerceOptionValue(option, raw);
  }

  #buildField(option, value) {
    const field = document.createElement('label');
    field.className = option.kind === OptionKind.TOGGLE ? 'field field--inline' : 'field';
    const control = this.#buildControl(option, value);
    if (option.kind === OptionKind.TOGGLE) {
      field.append(control, buildToggleLabel(option));
    } else {
      field.append(buildFieldLabel(option), control);
      if (option.helpText) {
        field.append(buildHelpText(option.helpText));
      }
    }
    return field;
  }

  #buildControl(option, value) {
    const builders = {
      [OptionKind.CHOICE]: buildSelect,
      [OptionKind.INTEGER]: buildNumberInput,
      [OptionKind.TOGGLE]: buildCheckbox,
    };
    const control = builders[option.kind](option, value ?? option.default);
    control.dataset.optionKey = option.key;
    control.addEventListener('change', () => this.#onOptionsChanged(this.collectValues()));
    return control;
  }
}

function buildFieldLabel(option) {
  const label = document.createElement('span');
  label.className = 'field__label';
  label.textContent = option.label;
  return label;
}

function buildToggleLabel(option) {
  const wrapper = document.createElement('span');
  const label = document.createElement('span');
  label.className = 'field__label';
  label.style.marginBottom = '0';
  label.textContent = option.label;
  wrapper.append(label);
  if (option.helpText) {
    wrapper.append(buildHelpText(option.helpText));
  }
  return wrapper;
}

function buildHelpText(text) {
  const help = document.createElement('p');
  help.className = 'field__help';
  help.textContent = text;
  return help;
}

function buildSelect(option, value) {
  const select = document.createElement('select');
  for (const [label, choiceValue] of option.choices) {
    const optionElement = document.createElement('option');
    optionElement.value = choiceValue;
    optionElement.textContent = label;
    optionElement.selected = choiceValue === value;
    select.append(optionElement);
  }
  return select;
}

function buildNumberInput(option, value) {
  const input = document.createElement('input');
  input.type = 'number';
  input.min = option.minimum;
  input.max = option.maximum;
  input.value = value;
  return input;
}

function buildCheckbox(option, value) {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = Boolean(value);
  return input;
}
