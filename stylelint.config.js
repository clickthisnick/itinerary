/** @type {import('stylelint').Config} */
export default {
  extends: ["stylelint-config-standard"],
  rules: {
    // Cerulean turns on grayscale antialiasing. The unprefixed property does not exist.
    "property-no-vendor-prefix": [
      true,
      { ignoreProperties: ["font-smoothing"] },
    ],
  },
};
