#!/usr/bin/env node

// Polyfill for fetch and related browser APIs
const fetch = require('node-fetch');
global.fetch = fetch;
global.Headers = fetch.Headers;
global.Request = fetch.Request;
global.Response = fetch.Response;

const { Command } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const figlet = require('figlet');
const ora = require('ora');
const { setConfig, getApiKey, getConfig } = require('../lib/config');
const { loadProjectConfig } = require('../lib/projectConfig');
const { addReview } = require('../lib/database');
const { performReview } = require('../lib/reviewer');
const { getCodeContent } = require('../lib/scanner');
const { getChangedFiles, getBlameForFile } = require('../lib/git');
const { printMarkdownReport, generateMarkdownReport } = require('../lib/markdownReport');
const fs = require('fs');
const path = require('path');

const program = new Command();
const config = getConfig();
const defaultModel = config.provider === 'google' ? 'gemini-1.5-pro-latest' : 'gpt-4o';

// Define the main program
program
  .name('lucai')
  .description('A powerful, AI-driven code review CLI.')
  .version('0.0.1');

// Review command
program.command('review')
  .description('Perform an AI-enhanced code review.')
  .option('--path <path>', 'Path to a directory to scan')
  .option('--file <file>', 'Path to a single file to scan')
  .option('--diff', 'Review files changed in the last commit')
  .option('--model <name>', `AI model to use (e.g., gpt-4o, gemini-1.5-pro-latest). Default: ${defaultModel}`, defaultModel)
  .option('--output <format>', 'Output format (markdown, json, inline). Default: markdown.')
  .option('--output-file <filename>', 'Save the markdown report to a file.')
  .option('--prompt <file>', 'Path to a custom system prompt file')
  .option('--summary', 'Append an executive summary to the review')
  .option('--blame', 'Attribute code authorship via git blame')
  .option('--track', 'Save quality scores over time')
  .option('--profile <name>', 'Run a review with a specific profile from your .lucai.json')
  .action(reviewAction);

// Separate command for configuration
program.command('configure')
  .description('Configure your AI provider and API key.')
  .action(configureAction);

// Custom help display
program.on('--help', () => {
  displayCustomHelp();
});

// If no command or options are provided, show custom help
if (process.argv.length <= 2) {
  displayCustomHelp();
} else {
  program.parse(process.argv);
}

// --- Action Handlers ---

async function reviewAction(options) {
  const projectConfig = loadProjectConfig();
  const mergedOptions = { ...projectConfig, ...options };

  const model = mergedOptions.model;
  const provider = model.startsWith('gemini') ? 'google' : 'openai';
  const apiKey = getApiKey(provider);

  if (!apiKey) {
    console.log(chalk.yellow(`${provider.charAt(0).toUpperCase() + provider.slice(1)} API key not found.`));
    console.log(`Please run ${chalk.cyan('lucai configure')} to set it up.`);
    return;
  }

  const reviewPath = mergedOptions.path || mergedOptions.file;
  if (!reviewPath && !mergedOptions.diff) {
    console.log(chalk.red('Error: A review target is required. Use --path, --file, or --diff.'));
    console.log(`Example: ${chalk.cyan('lucai review --path ./src')} or ${chalk.cyan('lucai review --diff')}`);
    return;
  }

  const spinner = ora('Scanning files and preparing for review...').start();
  let reviewResult;
  try {
    let files;
    if (mergedOptions.diff) {
      spinner.text = 'Getting changed files from git...';
      files = await getChangedFiles();
    } else {
      files = await getCodeContent(reviewPath);
    }

    if (mergedOptions.outputFile) {
      const initialReport = generateMarkdownReport({ files: [] }, false, mergedOptions.diff ? 'diff' : 'standard');
      fs.writeFileSync(path.resolve(mergedOptions.outputFile), initialReport);
    }

    if (files.length === 0) {
      spinner.warn('No supported files found to review.');
      return;
    }

    const onProgress = (completed, total) => {
      spinner.text = `The AI is reviewing your code... [${completed}/${total}]`;
    };

    spinner.text = 'The AI is reviewing your code...';
    const isSingleFile = !!mergedOptions.file;
    reviewResult = await performReview(files, model, isSingleFile, !!mergedOptions.diff, onProgress, mergedOptions);
    spinner.succeed('Review complete!');

    if (mergedOptions.blame) {
      spinner.start('Attributing authorship...');
      for (const fileReview of reviewResult.files) {
        const blameData = await getBlameForFile(fileReview.path);
        if (blameData) {
          const blameMap = new Map(blameData.lines.map(l => [l.line, l.author]));
          const sections = ['dangers', 'issues', 'suggestions', 'fix'];
          for (const section of sections) {
            if (fileReview[section]) {
              for (const item of fileReview[section]) {
                if (item.line && blameMap.has(item.line)) {
                  item.author = blameMap.get(item.line);
                }
              }
            }
          }
        }
      }
      spinner.succeed('Authorship attributed.');
    }

    if (mergedOptions.diff) {
      reviewResult.reviewType = 'diff';
    }

    if (mergedOptions.output === 'json') {
      const jsonReport = JSON.stringify(reviewResult, null, 2);
      if (mergedOptions.outputFile) {
        fs.writeFileSync(path.resolve(mergedOptions.outputFile), jsonReport);
        console.log(chalk.green(`\n✅ JSON report saved to ${mergedOptions.outputFile}`));
      } else {
        console.log(jsonReport);
      }
    } else { // Default to markdown
      if (mergedOptions.outputFile) {
        const report = generateMarkdownReport(reviewResult);
        const filePath = path.resolve(mergedOptions.outputFile);
        fs.writeFileSync(filePath, report);
        console.log(chalk.green(`\n✅ Report saved to ${filePath}`));
      } else {
        printMarkdownReport(reviewResult);
      }
    }
    
    if (mergedOptions.track) {
      await addReview({
        path: reviewPath,
        score: reviewResult.score,
      });
      console.log(chalk.gray('\nReview score has been saved to your local history.'));
    }
  } catch (error) {
    spinner.fail(error.message);
  } finally {
    if (mergedOptions.outputFile && reviewResult) {
      const report = generateMarkdownReport(reviewResult);
      const filePath = path.resolve(mergedOptions.outputFile);
      fs.writeFileSync(filePath, report);
      console.log(chalk.green(`\n✅ Report saved to ${filePath}`));
    }
  }
}

async function configureAction() {
  const { provider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Select your AI provider:',
      choices: ['openai', 'google'],
    },
  ]);

  const existingApiKey = getApiKey(provider);
  if (existingApiKey) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `An API key for ${provider} already exists. Do you want to overwrite it?`,
        default: false,
      },
    ]);
    if (!overwrite) {
      console.log(chalk.yellow('Configuration cancelled.'));
      return;
    }
  }

  const { apiKey } = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message: `Please enter your ${provider.charAt(0).toUpperCase() + provider.slice(1)} API key:`,
      mask: '*',
      validate: (input) => (input.length > 0 ? true : 'API key cannot be empty.'),
    },
  ]);
  setConfig(provider, apiKey);
  console.log(chalk.green(`✅ ${provider.charAt(0).toUpperCase() + provider.slice(1)} API key saved successfully!`));
  console.log('You can now use the `review` command.');
}

// --- Help Display ---

function displayCustomHelp() {
  const config = getConfig();
  const defaultModel = config.provider === 'google' ? 'gemini-1.5-pro-latest' : 'gpt-4o';

  console.log(chalk.cyan(figlet.textSync('lucai', { horizontalLayout: 'default' })));
  console.log(chalk.bold.cyan('             Your AI Code Review Assistant ✨\n'));
  console.log(chalk.bold.underline('Description:'));
  console.log(chalk.gray('  A powerful, AI-driven code review CLI that provides deep, contextual feedback.\n'));
  console.log(chalk.bold.underline('Usage:'));
  console.log('  lucai <command> [options]\n');
  console.log(chalk.bold.underline('Commands:'));
  const commands = [
    { cmd: 'review', desc: 'Perform an AI-enhanced code review.' },
    { cmd: 'configure', desc: 'Configure your AI provider and API key.' },
    { cmd: 'help', desc: 'Display help for a command.' },
  ];
  commands.forEach((c) => {
    console.log(`  ${chalk.cyan(c.cmd.padEnd(15))} ${chalk.gray(c.desc)}`);
  });
  console.log('\nRun `lucai <command> --help` for more information on a specific command.');
  console.log('');
  console.log(chalk.gray('  Created by Glenn Allogho (glennfreelance365@gmail.com)'));
  console.log(chalk.gray('  LinkedIn: glenn-allogho-94649688 | Twitter: @glenn_all | Github: @allglenn'));
  console.log();
}