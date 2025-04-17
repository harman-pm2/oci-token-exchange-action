module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Require a Signed-off-by line in the commit message footer
    'signed-off-by': [2, 'always', 'Signed-off-by:']
  },
  plugins: [
    {
      rules: {
        'signed-off-by': ({ raw }) => {
          // Check if any line in the commit message contains "Signed-off-by:"
          const hasSignoff = raw.split('\n').some(line =>
            /^Signed-off-by:/i.test(line.trim())
          );
          return [
            hasSignoff,
            'Commit message must contain a Signed-off-by line (use --signoff or -s)'
          ];
        }
      }
    }
  ]
};
