const fs = require('fs');
const path = require('path');

const IGNORED_DIRS = ['node_modules', '.git', 'dist', 'build'];
const ALLOWED_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.py', '.rb', '.go', '.java', '.cs'];

/**
 * Recursively scans a directory for source code files.
 * @param {string} dirPath - The absolute path to the directory to scan.
 * @returns {Array<{path: string, content: string}>} An array of file objects.
 */
function scanDirectory(dirPath) {
  let files = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory() && !IGNORED_DIRS.includes(entry.name)) {
      files = files.concat(scanDirectory(fullPath));
    } else if (entry.isFile() && ALLOWED_EXTENSIONS.includes(path.extname(entry.name))) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        files.push({ path: path.relative(process.cwd(), fullPath), content });
      } catch (error) {
        console.warn(`Could not read file: ${fullPath}`, error);
      }
    }
  }
  return files;
}

/**
 * Gets the content of the code to be reviewed based on the path option.
 * @param {string} reviewPath - The path to a file or directory.
 * @returns {Promise<Array<{path: string, content: string}>>} A promise that resolves to the content.
 */
async function getCodeContent(reviewPath) {
  const absolutePath = path.resolve(reviewPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Path does not exist: ${absolutePath}`);
  }

  const stats = fs.statSync(absolutePath);

  if (stats.isDirectory()) {
    return scanDirectory(absolutePath);
  } else if (stats.isFile()) {
    if (ALLOWED_EXTENSIONS.includes(path.extname(absolutePath))) {
      const content = fs.readFileSync(absolutePath, 'utf-8');
      return [{ path: path.relative(process.cwd(), absolutePath), content }];
    } else {
      throw new Error(`Unsupported file type: ${path.extname(absolutePath)}`);
    }
  } else {
    throw new Error(`Path is not a file or directory: ${absolutePath}`);
  }
}

module.exports = {
  getCodeContent,
}; 