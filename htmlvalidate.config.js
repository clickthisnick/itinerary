export default {
  extends: ["html-validate:recommended"],
  rules: {
    // Prettier prints lowercase doctype and self-closed void tags.
    "doctype-style": ["error", { style: "lowercase" }],
    "void-style": ["error", { style: "selfclose" }],
    // These pages have no <title>. Adding one would change the browser tab.
    "element-required-content": "off",
    // The clock heading is empty until startTime runs. Placeholder text would show first.
    "empty-heading": "off",
  },
};
