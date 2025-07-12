// lib/reviewer.js
// Handles GPT or lint-based analysis for lucai

const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const { getApiKey } = require('./config');

const getSystemPrompt = () => {
  return `
You are an expert AI code reviewer, acting as a CTO or senior architect. Your task is to provide a structured, insightful, and constructive code review for the single file provided.

Analyze the provided code file and respond with a JSON object ONLY. Do not include any text, markdown, or commentary outside of the JSON object. 
Make sure the JSON is clean and parseable. Do not include the markdown specifier \`\`\`json.

The JSON object must have the following structure:
{
  "dangers": [
    { "line": 42, "description": "Critical issue description." }
  ],
  "issues": [
    { "line": 88, "description": "Notable problem description." }
  ],
  "suggestions": [
    { "line": 12, "description": "Optional improvement suggestion." }
  ],
  "good_practices": [
    { "line": 25, "description": "Positive highlight description." }
  ],
  "fix": [
    { "line": 50, "explanation": "A brief explanation of what the fix does and why it improves the original.", "code": "the corrected code snippet" }
  ],
  "score": 85,
  "summary": "A one-paragraph, manager-friendly summary of the code's health, risks, and strengths for this specific file."
}

Please follow these detailed instructions for each section:

- 🛑 Dangers (the "dangers" array):
  - List critical issues ONLY, such as security vulnerabilities, crashes, undefined behavior, data loss risks, or dangerous API usage.
  - Before reporting a security vulnerability (e.g., SQL injection), verify it is real and not a false positive.
  - ONLY include this section if a real danger exists. Otherwise, omit the "dangers" key or leave it as an empty array.

- ⚠️ Issues (the "issues" array):
  - List notable problems that may lead to bugs, performance issues, or confusing code.

- 💡 Suggestions (the "suggestions" array):
  - List optional improvements to structure, readability, or best practices.

- ✅ Good Practices (the "good_practices" array):
  - List positive highlights — clean logic, good naming, idiomatic structure, proper abstractions, etc.

- 🛠️ Fix (the "fix" array):
  - Provide a corrected code snippet for each "danger" or "issue" identified.
  - The "explanation" should be a brief comment explaining what the fix does and why it's an improvement.
  - The "code" field must be a string formatted as a diff, using "- " for lines to remove and "+ " for lines to add. Do not include unchanged lines of code.

- Score & Summary:
  - The 'score' should be an integer between 0 and 100 for this file.
  - If the score is above 75, the 'summary' should be very brief.
  - If the score is 100, the 'summary' should simply state that the code is excellent.
  `;
};

async function generateOverallSummary(reviewResults, model) {
  const provider = model.startsWith('gemini') ? 'google' : 'openai';
  const apiKey = getApiKey(provider);

  const summaryPrompt = `
    You are a CTO reviewing a code analysis report. Based on the following file summaries, please provide a high-level executive summary.
    Do not mention the scores, but focus on the key themes, risks, and strengths across all files.

    ${reviewResults.map(r => `File: ${r.path}\nSummary: ${r.summary}`).join('\n\n')}
  `;

  try {
    if (provider === 'google') {
      const genAI = new GoogleGenerativeAI(apiKey);
      const gemini = genAI.getGenerativeModel({ model: model });
      const result = await gemini.generateContent(summaryPrompt);
      const response = await result.response;
      return response.text();
    } else {
      const openai = new OpenAI({ apiKey });
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: summaryPrompt },
        ],
      });
      return response.choices[0].message.content;
    }
  } catch (error) {
    console.error('Failed to generate overall summary:', error.message);
    return 'Could not generate an overall summary.';
  }
}

function cleanJsonString(jsonString) {
  return jsonString.replace(/^```json\n/, '').replace(/\n```$/, '');
}

/**
 * Performs a code review using the OpenAI API on a file-by-file basis.
 * @param {Array<{path: string, content: string}>} files - The code files to review.
 * @param {string} model - The AI model to use.
 * @returns {Promise<object>} A promise that resolves to the aggregated review result.
 */
async function performReview(files, model = 'gpt-4o') {
  const provider = model.startsWith('gemini') ? 'google' : 'openai';
  const apiKey = getApiKey(provider);
  if (!apiKey) {
    throw new Error(`${provider.charAt(0).toUpperCase() + provider.slice(1)} API key not found. Please run \`lucai configure\`.`);
  }

  const reviewResults = [];
  let client;

  if (provider === 'google') {
    const genAI = new GoogleGenerativeAI(apiKey);
    client = genAI.getGenerativeModel({ model: model });
  } else {
    client = new OpenAI({ apiKey });
  }

  for (const file of files) {
    const userPrompt = `Please review the following code from file: ${file.path}\n\n${file.content}`;
    try {
      let result;
      if (provider === 'google') {
        const response = await client.generateContent([getSystemPrompt(), userPrompt]);
        const textResponse = await response.response.text();
        result = JSON.parse(cleanJsonString(textResponse));
      } else {
        const response = await client.chat.completions.create({
          model: model,
          messages: [
            { role: 'system', content: getSystemPrompt() },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
        });
        result = JSON.parse(response.choices[0].message.content);
      }
      reviewResults.push({ path: file.path, ...result });

    } catch (error) {
      console.error(`Error reviewing file ${file.path}:`, error.message);
    }
  }

  const aggregatedResult = {
    files: reviewResults,
    summary: 'Overall review summary across all files.',
    score: 0,
  };
  
  if (reviewResults.length > 0) {
    const totalScore = reviewResults.reduce((sum, result) => sum + (result.score || 0), 0);
    aggregatedResult.score = Math.round(totalScore / reviewResults.length);
    aggregatedResult.summary = await generateOverallSummary(reviewResults, model);
  }

  return aggregatedResult;
}

module.exports = {
  performReview,
}; 