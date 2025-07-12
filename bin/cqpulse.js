#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const figlet = require('figlet');
const ora = require('ora');
const { setConfig, getApiKey, getConfig } = require('../lib/config');
const { addReview } = require('../lib/database');
const { performReview } = require('../lib/reviewer');
const { getCodeContent } = require('../lib/scanner');
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
  .version('0.0.1')
  .option('--path <path>', 'Path to a directory to scan')
  .option('--file <file>', 'Path to a single file to scan')
  .option('--model <name>', `AI model to use (e.g., gpt-4o, gemini-1.5-pro-latest). Default: ${defaultModel}`, defaultModel)
  .option('--output <format>', 'Output format (markdown, json, inline). Default: markdown.')
  .option('--output-file <filename>', 'Save the markdown report to a file.')
  .option('--prompt <file>', 'Path to a custom system prompt file')
  .option('--summary', 'Append an executive summary to the review')
  .option('--blame', 'Attribute code authorship via git blame')
  .option('--track', 'Save quality scores over time')
  .action(reviewAction); // The main action is the review

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
  const model = options.model;
  const provider = model.startsWith('gemini') ? 'google' : 'openai';
  const apiKey = getApiKey(provider);

  if (!apiKey) {
    console.log(chalk.yellow(`${provider.charAt(0).toUpperCase() + provider.slice(1)} API key not found.`));
    console.log(`Please run ${chalk.cyan('lucai configure')} to set it up.`);
    return;
  }

  const reviewPath = options.path || options.file;
  if (!reviewPath) {
    console.log(chalk.red('Error: The --path or --file option is required for a review.'));
    console.log(`Example: ${chalk.cyan('lucai --path ./src')} or ${chalk.cyan('lucai --file src/main.js')}`);
    return;
  }

  const spinner = ora('Scanning files and preparing for review...').start();
  try {
    const files = await getCodeContent(reviewPath);
    if (files.length === 0) {
      spinner.warn('No supported files found in the specified path.');
      return;
    }
    spinner.text = 'The AI is reviewing your code. This may take a moment...';
    const isSingleFile = !!options.file;
    const reviewResult = await performReview(files, model, isSingleFile);
    spinner.stop();
    if (options.outputFile) {
      const report = generateMarkdownReport(reviewResult);
      const filePath = path.resolve(options.outputFile);
      fs.writeFileSync(filePath, report);
      spinner.succeed(`Review complete! Report saved to ${filePath}`);
    } else {
      printMarkdownReport(reviewResult);
    }
    if (options.track) {
      await addReview({
        path: reviewPath,
        score: reviewResult.score,
      });
      console.log(chalk.gray('\nReview score has been saved to your local history.'));
    }
  } catch (error) {
    spinner.fail(error.message);
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
  console.log('  lucai [options]\n');
  console.log(chalk.bold.underline('Options:'));
  const options = [
    { opt: '--path <path>', desc: 'Path to a directory to scan.' },
    { opt: '--file <file>', desc: 'Path to a single file to scan.' },
    { opt: '--model <name>', desc: `AI model to use. Default: ${defaultModel}.` },
    { opt: '--output <format>', desc: 'Output format (markdown, json, inline). Default: markdown.' },
    { opt: '--output-file <filename>', desc: 'Save the markdown report to a file.' },
    { opt: '--track', desc: 'Save quality scores to local history.' },
    { opt: '--summary', desc: 'Append an executive summary to the review.' },
    { opt: '--help', desc: 'Display help for command.' },
  ];
  options.forEach((o) => {
    console.log(`  ${chalk.cyan(o.opt.padEnd(25))} ${chalk.gray(o.desc)}`);
  });
  console.log('');
  console.log(chalk.bold.underline('Commands:'));
  const commands = [
    { cmd: 'configure', desc: 'Configure your AI provider and API key.' },
  ];
  commands.forEach((c) => {
    console.log(`  ${chalk.cyan(c.cmd.padEnd(25))} ${chalk.gray(c.desc)}`);
  });
  console.log('');
  console.log(chalk.gray('  Created by Glenn Allogho (glennfreelance365@gmail.com)'));
  console.log(chalk.gray('  LinkedIn: glenn-allogho | Twitter: @glenn_all | Github: @allglenn'));
  console.log();
} 