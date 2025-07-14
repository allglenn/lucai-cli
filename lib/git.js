const { simpleGit } = require('simple-git');
const fs = require('fs').promises;
const path = require('path');
const minimatch = require('minimatch');

const git = simpleGit();
let ignorePatterns = [];

function loadIgnorePatterns() {
  const ignoreFilePath = path.join(process.cwd(), '.lucaiignore');
  try {
    const ignoreFileContent = fs.readFileSync(ignoreFilePath, 'utf-8');
    ignorePatterns = ignoreFileContent.split(/\r?\n/).filter(line => line.trim() !== '' && !line.startsWith('#'));
  } catch (err) {
    ignorePatterns = [];
  }
}

/**
 * Gets the content of files that have changed in the pull request.
 * In GitHub Actions, this compares the PR branch with the target branch.
 * @returns {Promise<Array<{path: string, content: string, diff: string}>>} A promise that resolves to an array of file objects with their diff.
 */
async function getChangedFiles() {
  loadIgnorePatterns();

  // In GitHub Actions, we want to compare the PR branch with the target branch
  // The action runs on the PR branch, so we compare with the base branch
  const baseBranch = process.env.GITHUB_BASE_REF || 'main';
  const currentBranch = process.env.GITHUB_HEAD_REF || 'HEAD';

  // If we're in a GitHub Action context, compare with the base branch
  // Otherwise, fall back to the last commit comparison
  const compareWith = process.env.GITHUB_ACTIONS ? baseBranch : 'HEAD~1';

  try {
    const diffSummary = await git.diffSummary([compareWith]);
    let files = [];

    for (const file of diffSummary.files) {
      const isIgnored = ignorePatterns.some(pattern => minimatch(file.file, pattern, { dot: true }));
      if (isIgnored) {
        continue;
      }

      if (file.changes > 0) {
        try {
          const content = await fs.readFile(path.resolve(file.file), 'utf-8');
          const diff = await git.diff([compareWith, '--', file.file]);
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
  } catch (error) {
    console.error(`Error getting changed files: ${error.message}`);
    console.error(`Falling back to HEAD~1 comparison`);

    // Fallback to HEAD~1 if the base branch comparison fails
    const diffSummary = await git.diffSummary(['HEAD~1']);
    let files = [];

    for (const file of diffSummary.files) {
      const isIgnored = ignorePatterns.some(pattern => minimatch(file.file, pattern, { dot: true }));
      if (isIgnored) {
        continue;
      }

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
 * Gets the git blame information for a specific file.
 * @param {string} filePath - The path to the file.
 * @returns {Promise<object>} A promise that resolves to the blame data.
 */
async function getBlameForFile(filePath) {
  try {
    const blame = await git.blame(['--porcelain', filePath]);
    const blameData = {
      file: filePath,
      lines: [],
    };

    const blameLines = blame.split('\n');
    let author = '';
    let authorMail = '';
    let lineNum = 0;

    blameLines.forEach((line, index) => {
      if (line.startsWith('author ')) {
        author = line.substring(7);
      } else if (line.startsWith('author-mail ')) {
        authorMail = line.substring(12);
      } else if (line.startsWith('\t')) {
        lineNum++;
        blameData.lines.push({ line: lineNum, author: `${author} ${authorMail}` });
      }
    });

    return blameData;
  } catch (error) {
    console.warn(`Could not get blame for file: ${filePath}`, error);
    return null;
  }
}

module.exports = {
  getChangedFiles,
  getBlameForFile,
}; 