// Polyfill for fetch
global.fetch = require('node-fetch');

const core = require('@actions/core');
const github = require('@actions/github');
const { execSync } = require('child_process');
const { generateMarkdownReport } = require('./markdownReport');

async function run() {
  try {
    const githubToken = core.getInput('github-token', { required: true });
    const openaiApiKey = core.getInput('openai-api-key');
    const googleApiKey = core.getInput('google-api-key');

    let modelName = '';
    if (openaiApiKey) {
      modelName = 'gpt-4o'; // Default OpenAI model
      core.exportVariable('OPENAI_API_KEY', openaiApiKey);
      core.info('Using OpenAI provider with model gpt-4o.');
    } else if (googleApiKey) {
      modelName = 'gemini-1.5-pro-latest'; // Default Google model
      core.exportVariable('GOOGLE_API_KEY', googleApiKey);
      core.info('Using Google provider with model gemini-1.5-pro-latest.');
    } else {
      core.setFailed('No API key provided. Please provide either `openai-api-key` or `google-api-key` as an input to the action.');
      return;
    }

    const octokit = github.getOctokit(githubToken);
    const { context } = github;

    if (!context.payload.pull_request) {
      core.setFailed('This action only runs on pull requests.');
      return;
    }

    core.info('✅ Action setup complete. Starting review process...');
    
    // Configure and run lucai
    core.info('Installing lucai dependencies...');
    execSync('npm install');
    core.info('Linking lucai CLI...');
    execSync('npm link'); // Ensure lucai is available
    core.info('Running lucai review...');
    const command = `lucai review --diff --output json --model ${modelName}`;
    core.info(`Executing: ${command}`);
    const reviewOutput = execSync(command).toString();
    const reviewResult = JSON.parse(reviewOutput);

    // Format and post the comment
    const commentBody = generateMarkdownReport(reviewResult); // We'll reuse our report generator
    await octokit.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.payload.pull_request.number,
      body: commentBody,
    });

    core.info('✅ Review complete and comment posted.');

  } catch (error) {
    core.setFailed(error.message);
  }
}

run(); 