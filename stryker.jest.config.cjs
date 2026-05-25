/**
 * Dedicated jest config for Stryker — runs ONLY the domain unit specs that
 * exercise the mutated files. The main jest config uses `projects` which
 * Stryker's jest runner can't drive, so this is a flat slice with the same
 * transform/moduleNameMapper as the unit project.
 */
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testMatch: [
    '<rootDir>/src/modules/catalog/category/domain/**/*.spec.ts',
    '<rootDir>/src/modules/catalog/product/domain/**/*.spec.ts',
    '<rootDir>/src/shared/domain/**/*.spec.ts',
  ],
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  moduleNameMapper: { '^src/(.*)$': '<rootDir>/src/$1' },
  testTimeout: 30000,
};
