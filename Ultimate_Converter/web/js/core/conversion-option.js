/** User-facing settings that fine-tune a single conversion. */

export const OptionKind = Object.freeze({
  CHOICE: 'choice',
  INTEGER: 'integer',
  TOGGLE: 'toggle',
});

export const AUTOMATIC = '__automatic__';
/** Sentinel meaning "keep whatever the source file already uses". */

/** Report whether an option value asks for the source setting to be kept. */
export function isAutomatic(value) {
  return value === AUTOMATIC;
}

/** Build a dropdown option whose first entry is the default. */
export function choiceOption(key, label, choices, helpText = '') {
  return {
    key,
    label,
    kind: OptionKind.CHOICE,
    choices,
    default: choices[0][1],
    helpText,
  };
}

/** Build a bounded numeric option. */
export function integerOption(key, label, { value, minimum, maximum, helpText = '' }) {
  return {
    key,
    label,
    kind: OptionKind.INTEGER,
    default: value,
    minimum,
    maximum,
    helpText,
  };
}

/** Build an on/off option. */
export function toggleOption(key, label, { value = false, helpText = '' } = {}) {
  return { key, label, kind: OptionKind.TOGGLE, default: value, helpText };
}

/** Return `rawValue` converted to the option's own value type. */
export function coerceOptionValue(option, rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return option.default;
  }
  if (option.kind === OptionKind.INTEGER) {
    return clampInteger(option, rawValue);
  }
  if (option.kind === OptionKind.TOGGLE) {
    return Boolean(rawValue);
  }
  return rawValue;
}

/** Merge chosen values onto the defaults, dropping keys the conversion ignores. */
export function applyOptionDefaults(options, chosenValues = {}) {
  return Object.fromEntries(
    options.map((option) => [option.key, coerceOptionValue(option, chosenValues[option.key])]),
  );
}

function clampInteger(option, rawValue) {
  const parsed = Number.parseInt(rawValue, 10);
  if (Number.isNaN(parsed)) {
    return option.default;
  }
  return Math.min(option.maximum ?? parsed, Math.max(option.minimum ?? parsed, parsed));
}
