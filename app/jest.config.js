module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  roots: ["<rootDir>/../tests"],
  testMatch: ["**/auction.test.ts"],
};
