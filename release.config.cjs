/**
 * @type {import('semantic-release').GlobalConfig}
 */
module.exports = {
  plugins: [
    '@semantic-release/commit-analyzer', {
      preset: 'conventionalcommits'
    },
    '@semantic-release/release-notes-generator',
    '@semantic-release/npm',
    '@semantic-release/github',
  ],
  branches: ['main', 'next'],
};
