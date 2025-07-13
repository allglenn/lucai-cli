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

/**
 * Gets git blame information for a specific file.
 * @param {string} filePath - The path to the file.
 * @returns {Promise<object|null>} A promise that resolves to the blame data, or null if it fails.
 */
async function getBlameForFile(filePath) {
  try {
    const blame = await git.blame(['--', filePath]);
    return blame;
  } catch (error) {
    // Silently fail for untracked files or other errors
    return null;
  }
}

module.exports = {
  getChangedFiles,
  getBlameForFile,
}; 