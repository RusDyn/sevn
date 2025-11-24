/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  transform: {
    '^.+\\.(ts|tsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { modules: 'commonjs' }],
        '@babel/preset-typescript'
      ],
      plugins: ['babel-plugin-transform-import-meta']
    }],
  },
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
};
