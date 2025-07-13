const { simpleGit } = require('simple-git');
const fs = require('fs').promises;
const path = require('path');

const git = simpleGit();

/**
 * Gets the content of files that have changed in the pull request.
 * In GitHub Actions, this compares the PR branch with the target branch.
 * @returns {Promise<Array<{path: string, content: string, diff: string}>>} A promise that resolves to an array of file objects with their diff.
 */
async function getChangedFiles() {
  // In GitHub Actions, we want to compare the PR branch with the target branch
  // The action runs on the PR branch, so we compare with the base branch
  const baseBranch = process.env.GITHUB_BASE_REF || 'main';
  const currentBranch = process.env.GITHUB_HEAD_REF || 'HEAD';
  
  // If we're in a GitHub Action context, compare with the base branch
  // Otherwise, fall back to the last commit comparison
  const compareWith = process.env.GITHUB_ACTIONS ? baseBranch : 'HEAD~1';
  
  console.log(`GitHub Actions: ${process.env.GITHUB_ACTIONS}`);
  console.log(`Base branch: ${baseBranch}`);
  console.log(`Current branch: ${currentBranch}`);
  console.log(`Comparing with: ${compareWith}`);
  
  try {
    // Check if the base branch exists locally
    const branches = await git.branch();
    console.log(`Available branches: ${branches.all.join(', ')}`);
    
    const diffSummary = await git.diffSummary([compareWith]);
    console.log(`Found ${diffSummary.files.length} files with changes`);
    
    const files = [];

    for (const file of diffSummary.files) {
      if (file.changes > 0) {
        try {
          const content = await fs.readFile(path.resolve(file.file), 'utf-8');
          const diff = await git.diff([compareWith, '--', file.file]);
          files.push({ path: file.file, content, diff });
          console.log(`Added file: ${file.file} (${file.changes} changes)`);
        } catch (error) {
          // Ignore errors for deleted files or files that can't be read
          if (error.code !== 'ENOENT') {
            console.warn(`Could not read file: ${file.file}`, error);
          }
        }
      }
    }

    console.log(`Total files to review: ${files.length}`);
    return files;
  } catch (error) {
    console.error(`Error getting changed files: ${error.message}`);
    console.error(`Falling back to HEAD~1 comparison`);
    
    // Fallback to HEAD~1 if the base branch comparison fails
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