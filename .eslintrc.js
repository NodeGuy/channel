module.exports = {
  env: {
    es6: true,
    mocha: true,
    node: true
  },
  parserOptions: {
    ecmaVersion: 2017
  },
  rules: {
    quotes: ["error", "backtick"],
    "no-undef": "error",
    "no-unused-vars": "warn"
  }
};
