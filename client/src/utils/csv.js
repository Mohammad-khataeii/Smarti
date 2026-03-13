// src/utils/csv.js
const Papa = window.Papa;

/**
 * Parse CSV text to array of objects.
 * - dynamicTyping: auto-casts numbers/booleans
 * - skipEmptyLines: ignore blank rows
 */
export function parseCsv(text, options = {}) {
  const { data, errors } = Papa.parse(text, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: "greedy",
    ...options,
  });
  if (errors && errors.length) {
    // Surface first error for debugging; you can enhance as needed
    // eslint-disable-next-line no-console
    console.warn("CSV parse warnings:", errors.slice(0, 3));
  }
  return data;
}
