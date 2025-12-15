// In many code locations we are doing JSON.stringify(value, null, 2);
// Crating this light wrapper so at least we are consistent.
export const jsonFormatter = (value: unknown) => JSON.stringify(value, null, 2);
