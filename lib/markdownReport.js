const chalk = require('chalk');

function formatSection(title, items, useChalk = true) {
  if (!items || items.length === 0) return '';
  let section = `### ${title}\n`;
  items.forEach(item => {
    const lineInfo = useChalk ? chalk.dim(`Line ${item.line || 'N/A'}`) : `Line ${item.line || 'N/A'}`;
    section += `- ${item.description} (${lineInfo})\n`;
  });
  return section + '\n';
}

function formatFixes(title, items, useChalk = true) {
  if (!items || items.length === 0) return '';
  let section = `### ${title}\n`;
  items.forEach(item => {
    const lineInfo = useChalk ? chalk.dim(`Line ${item.line || 'N/A'}`) : `Line ${item.line || 'N/A'}`;
    const explanation = useChalk ? chalk.gray(item.explanation) : item.explanation;
    const diff = useChalk
      ? '```diff\n' + item.code.split('\n').map(line => {
          if (line.startsWith('+')) return chalk.green(line);
          if (line.startsWith('-')) return chalk.red(line);
          return line;
        }).join('\n') + '\n```'
      : '```diff\n' + item.code + '\n```';

    section += `- **${explanation}** (${lineInfo})\n${diff}\n`;
  });
  return section + '\n';
}

function generateMarkdownReport(reviewData, useChalk = false) {
  let report = `# Code Review Report\n`;

  if (reviewData.score !== undefined) {
    report += `\n## 📊 Overall Quality Score: ${reviewData.score}/100\n`;
  }
  
  if (reviewData.summary) {
    report += `\n## 📝 Executive Summary\n\n${reviewData.summary}\n`;
  }
  
  reviewData.files.forEach(fileReview => {
    const fileHeader = useChalk ? chalk.bold.underline(`\n\n## 📄 File: ${fileReview.path}`) : `\n\n## 📄 File: ${fileReview.path}`;
    report += `${fileHeader}\n`;

    if (fileReview.score !== undefined && fileReview.summary) {
      report += `**Score: ${fileReview.score}/100** | *${fileReview.summary}*\n`;
    }
    
    report += formatSection('🛑 Dangers', fileReview.dangers, useChalk);
    report += formatSection('⚠️ Issues', fileReview.issues, useChalk);
    report += formatSection('💡 Suggestions', fileReview.suggestions, useChalk);
    report += formatSection('✅ Good Practices', fileReview.good_practices, useChalk);
    report += formatFixes('🛠️ Fixes', fileReview.fix, useChalk);
  });
  
  return report;
}

function printMarkdownReport(reviewData) {
  const reportString = generateMarkdownReport(reviewData, true); // use chalk for console
  // Minimal coloring for the console, as chalk is now handled in formatters
  console.log(reportString);
}

module.exports = {
  printMarkdownReport,
  generateMarkdownReport,
}; 