/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 30000,
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/setup.ts'],
  reporters: [
    'default',
    ['<rootDir>/src/security-reporter.js', {}]
  ],
  verbose: true
};
