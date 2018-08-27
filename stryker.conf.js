module.exports = function(config) {
  config.set({
    testRunner: "mocha",
    mutator: "javascript",
    transpilers: [],
    reporter: ["clear-text", "progress"],
    testFramework: "mocha",
    coverageAnalysis: "perTest",
    mutate: ["lib/**/*.js"]
  });
};
