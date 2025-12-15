import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextCoreWebVitals,
  {
    rules: {
      "no-console": "error",
      "react-hooks/incompatible-library": "off",
    },
  },
  {
    files: ["jest.setup.ts", "jest.setup.cjs"],
    rules: {
      "no-console": "off",
    },
  },
];

export default config;
