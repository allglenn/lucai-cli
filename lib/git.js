const { simpleGit } = require('simple-git');
const fs = require('fs').promises;
const path = require('path');
const minimatch = require('minimatch');

const git = simpleGit();
let ignorePatterns = null; // Memoized patterns

async function loadIgnorePatterns() {
  if (ignorePatterns !== null) {
    return ignorePatterns; // Return memoized result
  }

  const ignoreFilePath = path.join(process.cwd(), '.lucaiignore');
  try {
    const ignoreFileContent = await fs.readFile(ignoreFilePath, 'utf-8');
    ignorePatterns = ignoreFileContent.split(/\r?\n/).filter(line => line.trim() !== '' && !line.startsWith('#'));
  } catch (err) {
    ignorePatterns = [];
  }
  return ignorePatterns;
}

/**
 * Gets the content of files that have changed in the pull request.
 * In GitHub Actions, this compares the PR branch with the target branch.
 * @returns {Promise<Array<{path: string, content: string, diff: string}>>} A promise that resolves to an array of file objects with their diff.
 */
async function getChangedFiles() {
  await loadIgnorePatterns();

  // Use consistent comparison logic for GitHub Actions
  const baseBranch = process.env.GITHUB_BASE_REF;
  const diffArgs = process.env.GITHUB_ACTIONS && baseBranch
    ? ['origin/' + baseBranch, 'HEAD']
    : ['HEAD~1'];

  try {
    // Use git.raw for more flexibility and to avoid shell injection
    const diffSummaryOutput = await git.raw(['diff', '--summary', ...diffArgs]);
    const files = [];

    // Parse the diff summary output
    const lines = diffSummaryOutput.split('\n').filter(line => line.trim());

    for (const line of lines) {
      // Parse diff summary line format: "mode mode hash hash file"
      const parts = line.split(/\s+/);
      if (parts.length >= 5) {
        const filePath = parts.slice(4).join(' '); // Handle filenames with spaces

        const isIgnored = ignorePatterns.some(pattern => minimatch(filePath, pattern, { dot: true }));
        if (isIgnored) {
          continue;
        }

        try {
          const content = await fs.readFile(path.resolve(filePath), 'utf-8');
          const diffOutput = await git.raw(['diff', ...diffArgs, '--', filePath]);
          files.push({ path: filePath, content, diff: diffOutput });
        } catch (error) {
          // Ignore errors for deleted files or files that can't be read
          if (error.code !== 'ENOENT') {
            console.warn(`Could not read file: ${filePath}`, error);
          }
        }
      }
    }

    return files;
  } catch (error) {
    console.error(`Error getting changed files: ${error.message}`);
    throw error; // Don't fallback to HEAD~1, let the error propagate
  }
}

/**
 * Gets the git blame information for a specific file.
 * @param {string} filePath - The path to the file.
 * @returns {Promise<object>} A promise that resolves to the blame data.
 */
async function getBlameForFile(filePath) {
  try {
    // Use git.raw for more reliable blame parsing
    const blameOutput = await git.raw(['blame', '--porcelain', filePath]);
    const blameData = {
      file: filePath,
      lines: [],
    };

    const blameLines = blameOutput.split('\n');
    let currentCommit = null;
    let lineNum = 0;

    for (const line of blameLines) {
      if (line.startsWith('author ')) {
        currentCommit = { author: line.substring(7) };
      } else if (line.startsWith('author-mail ') && currentCommit) {
        currentCommit.authorMail = line.substring(12);
      } else if (line.startsWith('\t') && currentCommit) {
        lineNum++;
        blameData.lines.push({
          line: lineNum,
          author: `${currentCommit.author} ${currentCommit.authorMail || ''}`.trim()
        });
      }
    }

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