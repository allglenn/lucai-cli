const { simpleGit } = require('simple-git');
const fs = require('fs').promises;
const path = require('path');

const git = simpleGit();

/**
 * Gets the content of files that have changed in the last commit.
 * @returns {Promise<Array<{path: string, content: string, diff: string}>>} A promise that resolves to an array of file objects with their diff.
 */
async function getChangedFiles() {
  const diffSummary = await git.diffSummary(['HEAD~1']);
  const files = [];

  for (const file of diffSummary.files) {
    if (file.changes > 0) {
      try {
        const content = await fs.readFile(path.resolve(file.file), 'utf-8');
        const diff = await git.diff(['HEAD~1', '--', file.file]);
        files.push({ path: file.file, content, diff });
      } catch (error) {
        // Ignore errors for deleted files or files that can't be read
        if (error.code !== 'ENOENT') {
          console.warn(`Could not read file: ${file.file}`, error);
        }
      }
    }
  }

  return files;
}

module.exports = {
  getChangedFiles,
}; 