// lib/reviewer.js
// Handles GPT or lint-based analysis for lucai

const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const { getEncoding } = require('js-tiktoken');
const { getApiKey } = require('./config');
const { formatFileReview } = require('./markdownReport');
const fs = require('fs').promises;
const path = require('path');

const CONTEXT_WINDOWS = {
  'gpt-4o': 128000,
  'gpt-4-turbo': 128000,
  'gpt-4': 8192,
  'gemini-1.5-pro-latest': 1048576,
  'gemini-1.0-pro': 30720,
};

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

const getDiffReviewSystemPrompt = () => {
  return `
You are an expert AI code reviewer, acting as a senior engineer reviewing a pull request. Your task is to analyze the provided code, which represents files that have been recently changed.

Your review should focus specifically on the **implications of these changes**. Do they introduce new bugs, security vulnerabilities, or anti-patterns? Do they align with the existing architecture? Are there better ways to implement the intended change?

Do not just review the file as a whole; concentrate on what might have been altered. Your feedback should be contextual to a code change event. **Omit the "good_practices" section entirely, as it is not relevant for a diff review.**

Analyze the provided code file and respond with a JSON object ONLY. Do not include any text, markdown, or commentary outside of the JSON object.
Make sure the JSON is clean and parseable. Do not include the markdown specifier \`\`\`json.

The JSON object must have the following structure:
{
  "dangers": [ { "line": 42, "description": "Critical issue description." } ],
  "issues": [ { "line": 88, "description": "Notable problem description." } ],
  "suggestions": [ { "line": 12, "description": "Optional improvement suggestion." } ],
  "fix": [ { "line": 50, "explanation": "A brief explanation of what the fix does.", "code": "the corrected code snippet" } ],
  "score": 85,
  "summary": "A one-paragraph, manager-friendly summary of the code's health, risks, and strengths for this specific file, focusing on the changes."
}
  `;
};

const getSingleFileReviewSystemPrompt = () => {
  return `
You are an expert AI code reviewer. Your task is to provide a structured, insightful, and constructive code review for the single file provided.
Focus purely on the analysis and potential fixes. Do not include a summary or a score.

Analyze the provided code file and respond with a JSON object ONLY. Do not include any text, markdown, or commentary outside of the JSON object.
Make sure the JSON is clean and parseable. Do not include the markdown specifier \`\`\`json.

The JSON object must have the following structure:
{
  "dangers": [ { "line": 42, "description": "Critical issue description." } ],
  "issues": [ { "line": 88, "description": "Notable problem description." } ],
  "suggestions": [ { "line": 12, "description": "Optional improvement suggestion." } ],
  "good_practices": [ { "line": 25, "description": "Positive highlight description." } ],
  "fix": [ { "line": 50, "explanation": "A brief explanation of what the fix does.", "code": "the corrected code snippet" } ]
}
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

async function countTokens(text, model) {
  const provider = model.startsWith('gemini') ? 'google' : 'openai';
  if (provider === 'google') {
    const apiKey = getApiKey('google');
    if (!apiKey) return text.length / 4; // Fallback approximation
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model });
    const { totalTokens } = await geminiModel.countTokens(text);
    return totalTokens;
  } else {
    // Note: getEncoding('cl100k_base') is a safe default for gpt-4, gpt-3.5-turbo, and text-embedding-ada-002
    const encoding = getEncoding('cl100k_base');
    const tokens = encoding.encode(text);
    return tokens.length;
  }
}

async function splitCodeIntoChunks(content, model, maxTokensPerChunk) {
  const lines = content.split('\n');
  const chunks = [];
  let currentChunkLines = [];
  let currentChunkTokens = 0;
  const overlapLines = 50; // 50 lines of overlap to maintain context

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineTokens = await countTokens(line + '\n', model);

    if (currentChunkTokens + lineTokens > maxTokensPerChunk && currentChunkLines.length > 0) {
      chunks.push({
        content: currentChunkLines.join('\n'),
        startLine: i - currentChunkLines.length + 1,
      });

      // Start the next chunk with an overlap
      const overlapStartIndex = Math.max(0, currentChunkLines.length - overlapLines);
      currentChunkLines = currentChunkLines.slice(overlapStartIndex);
      currentChunkTokens = await countTokens(currentChunkLines.join('\n'), model);
    }
    
    currentChunkLines.push(line);
    currentChunkTokens += lineTokens;
  }

  // Add the final chunk if any content is left
  if (currentChunkLines.length > 0) {
    chunks.push({
      content: currentChunkLines.join('\n'),
      startLine: lines.length - currentChunkLines.length + 1,
    });
  }

  return chunks;
}


function cleanJsonString(jsonString) {
  // Remove markdown formatting and any stray backticks
  return jsonString
    .replace(/^```json\s*/, '')
    .replace(/\s*```$/, '')
    .trim();
}

/**
 * Performs a code review using the OpenAI API on a file-by-file basis.
 * @param {Array<{path: string, content: string}>} files - The code files to review.
 * @param {string} model - The AI model to use.
 * @param {boolean} isSingleFile - Whether this is a review for a single file.
 * @returns {Promise<object>} A promise that resolves to the aggregated review result.
 */
async function performReview(files, model = 'gpt-4o', isSingleFile = false, isDiffReview = false, onProgress = () => {}) {
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

  let systemPrompt;
  if (isDiffReview) {
    systemPrompt = getDiffReviewSystemPrompt();
  } else if (isSingleFile) {
    systemPrompt = getSingleFileReviewSystemPrompt();
  } else {
    systemPrompt = getSystemPrompt();
  }
  
  const maxTokens = CONTEXT_WINDOWS[model] || 2048; // Default to 2048 if model not in map

  for (const [index, file] of files.entries()) {
    const totalTokens = await countTokens(file.content, model);
    
    if (totalTokens > maxTokens * 0.9) {
      // --- Chunking Logic ---
      console.log(`File ${file.path} is large (${totalTokens} tokens), splitting into chunks...`);
      const chunks = await splitCodeIntoChunks(file.content, model, maxTokens * 0.9);
      const chunkReviews = [];

      for (const [chunkIndex, chunk] of chunks.entries()) {
        console.log(`  - Reviewing chunk ${chunkIndex + 1}/${chunks.length}...`);
        const userPrompt = `This is chunk ${chunkIndex + 1}/${chunks.length} of the file ${file.path}. Please review the following code snippet which starts at line ${chunk.startLine}:\n\n${chunk.content}`;
        try {
          // Re-using the same AI call logic as for a single file
          let result;
          if (provider === 'google') {
            const response = await client.generateContent([systemPrompt, userPrompt]);
            const textResponse = await response.response.text();
            try {
              result = JSON.parse(cleanJsonString(textResponse));
            } catch (e) {
              console.error(`\nFailed to parse JSON for chunk ${chunkIndex + 1} of ${file.path}: ${e.message}`);
              result = {}; // Continue with an empty result for this chunk
            }
          } else {
            const response = await client.chat.completions.create({
              model: model,
              messages: [ { role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt } ],
              response_format: { type: 'json_object' },
            });
            try {
              result = JSON.parse(response.choices[0].message.content);
            } catch (e) {
              console.error(`\nFailed to parse JSON for chunk ${chunkIndex + 1} of ${file.path}: ${e.message}`);
              result = {}; // Continue with an empty result for this chunk
            }
          }
          // Adjust line numbers to be relative to the original file
          Object.keys(result).forEach(key => {
            if (Array.isArray(result[key])) {
              result[key].forEach(item => {
                if (item.line) {
                  item.line = item.line + chunk.startLine - 1;
                }
              });
            }
          });
          chunkReviews.push(result);
        } catch (error) {
          console.error(`Error reviewing chunk ${chunkIndex + 1} of ${file.path}:`, error.message);
        }
      }

      // Aggregate results from all chunks
      const aggregated = {
        dangers: [].concat(...chunkReviews.map(r => r.dangers || [])),
        issues: [].concat(...chunkReviews.map(r => r.issues || [])),
        suggestions: [].concat(...chunkReviews.map(r => r.suggestions || [])),
        good_practices: [].concat(...chunkReviews.map(r => r.good_practices || [])),
        fix: [].concat(...chunkReviews.map(r => r.fix || [])),
        score: Math.round(chunkReviews.reduce((sum, r) => sum + (r.score || 0), 0) / chunkReviews.length) || 0,
        summary: chunkReviews.map((r, i) => `Chunk ${i + 1}: ${r.summary}`).join('\n') || "Review completed for large file.",
      };
      reviewResults.push({ path: file.path, ...aggregated, diff: file.diff });

    } else {
      // --- Existing Logic for smaller files ---
      const userPrompt = `Please review the following code from file: ${file.path}\n\n${file.content}`;
      try {
        let result;
        if (provider === 'google') {
          const response = await client.generateContent([systemPrompt, userPrompt]);
          const textResponse = await response.response.text();
          try {
            result = JSON.parse(cleanJsonString(textResponse));
          } catch (e) {
            console.error(`\nFailed to parse JSON for ${file.path}: ${e.message}`);
            result = {}; // Continue with an empty result
          }
        } else {
          const response = await client.chat.completions.create({
            model: model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
          });
          try {
            result = JSON.parse(response.choices[0].message.content);
          } catch (e) {
            console.error(`\nFailed to parse JSON for ${file.path}: ${e.message}`);
            result = {}; // Continue with an empty result
          }
        }
        reviewResults.push({ path: file.path, ...result, diff: file.diff });

      } catch (error) {
        console.error(`\nError reviewing file ${file.path}:`, error.message);
      }
    }
    onProgress(index + 1, files.length);
  }

  const aggregatedResult = {
    files: reviewResults,
    summary: 'Overall review summary across all files.',
    score: 0,
  };
  
  if (isSingleFile) {
    delete aggregatedResult.summary;
    delete aggregatedResult.score;
  } else if (reviewResults.length > 0) {
    const totalScore = reviewResults.reduce((sum, result) => sum + (result.score || 0), 0);
    aggregatedResult.score = Math.round(totalScore / reviewResults.length);
    aggregatedResult.summary = await generateOverallSummary(reviewResults, model);
  }

  return aggregatedResult;
}

module.exports = {
  performReview,
}; 