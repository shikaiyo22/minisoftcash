const os = require('os');
const path = require('path');
const fs = require('fs');

const testDataDir = path.join(os.tmpdir(), 'money-manager-test-' + Date.now());
fs.mkdirSync(testDataDir, { recursive: true });

module.exports = {
  app: {
    getPath: (name) => {
      if (name === 'userData') return testDataDir;
      return os.tmpdir();
    },
  },
};
