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
You are an expert, concise AI code reviewer. Your task is to provide a structured, insightful, and brief code review.

- Be direct and technical. No conversational fluff.
- All descriptions must be a single, concise sentence.
- The summary must be a single, brief paragraph highlighting only the most critical findings.

Analyze the provided code file and respond with a JSON object ONLY. Do not include any text or commentary outside the JSON object.

The JSON object must have the following structure:
{
  "dangers": [ { "line": 42, "description": "Concise, one-sentence technical description of the critical issue." } ],
  "issues": [ { "line": 88, "description": "Concise, one-sentence technical description of the problem." } ],
  "suggestions": [ { "line": 12, "description": "Concise, one-sentence technical suggestion." } ],
  "good_practices": [ { "line": 25, "description": "Concise, one-sentence description of a good practice." } ],
  "fix": [ { "line": 50, "explanation": "A very brief explanation of the fix.", "code": "the corrected code snippet" } ],
  "score": 85,
  "headline": "A single, impactful, one-sentence technical summary of the file's state."
}

Please follow these detailed instructions for each section:
- 🛑 Dangers: Critical issues like security risks or crashes. Omit if none exist.
- ⚠️ Issues: Notable problems that could lead to bugs or performance issues.
- 💡 Suggestions: Optional improvements.
- ✅ Good Practices: Positive highlights.
- 🛠️ Fix: A corrected code snippet formatted as a diff for each danger/issue.
- Score & Headline: An integer score from 0-100 and a very brief, technical headline.
  `;
};

const getDiffReviewSystemPrompt = () => {
  return `
You are an expert, concise AI code reviewer analyzing a pull request.

- Focus **only** on the implications of the code changes.
- Be direct and technical. No conversational fluff.
- All descriptions must be a single, concise sentence.
- The summary must be a single, brief paragraph highlighting only the most critical issues introduced by the changes.
- **Omit the "good_practices" section.**

Analyze the provided code file and respond with a JSON object ONLY. Do not include any text or commentary outside the JSON object.

The JSON object must have the following structure:
{
  "dangers": [ { "line": 42, "description": "Concise, one-sentence technical description of the critical issue." } ],
  "issues": [ { "line": 88, "description": "Concise, one-sentence technical description of the problem." } ],
  "suggestions": [ { "line": 12, "description": "Concise, one-sentence technical suggestion." } ],
  "fix": [ { "line": 50, "explanation": "A very brief explanation of the fix.", "code": "the corrected code snippet" } ],
  "score": 85,
  "headline": "A single, impactful, one-sentence technical summary of the changes."
}
  `;
};

const getSingleFileReviewSystemPrompt = () => {
  return `
You are an expert, concise AI code reviewer. Your task is to provide a structured and brief code review.

- Be direct and technical. No conversational fluff.
- All descriptions must be a single, concise sentence.
- Do not include a headline or a score.

Analyze the provided code file and respond with a JSON object ONLY. Do not include any text or commentary outside of the JSON object.

The JSON object must have the following structure:
{
  "dangers": [ { "line": 42, "description": "Concise, one-sentence technical description of the critical issue." } ],
  "issues": [ { "line": 88, "description": "Concise, one-sentence technical description of the problem." } ],
  "suggestions": [ { "line": 12, "description": "Concise, one-sentence technical suggestion." } ],
  "good_practices": [ { "line": 25, "description": "Concise, one-sentence description of a good practice." } ],
  "fix": [ { "line": 50, "explanation": "A very brief explanation of what the fix does.", "code": "the corrected code snippet" } ]
}
  `;
};

async function generateOverallSummary(reviewResults, model) {
  const provider = model.startsWith('gemini') ? 'google' : 'openai';
  const apiKey = getApiKey(provider);

  const summaryPrompt = `
    You are a CTO reviewing a code analysis report. Based on the following file summaries, provide a high-level executive summary.
    The output must be a short, scannable summary.

    - Start with a single sentence overview.
    - Then, provide a bulleted list of the most critical themes, risks, and required actions.
    - Be concise and direct. Do not use conversational language.

    File Summaries:
    ${reviewResults.map(r => `File: ${r.path}\nHeadline: ${r.headline}`).join('\n\n')}
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


function cleanJsonString(text) {
  // Models can sometimes wrap the JSON in markdown or add commentary.
  // This function finds the full JSON block within the text.
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('No valid JSON object found in the AI response.');
  }

  // Extract the JSON string from the first '{' to the last '}'
  const jsonString = text.substring(firstBrace, lastBrace + 1);
  return jsonString;
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
        headline: chunkReviews.map((r, i) => `Chunk ${i + 1}: ${r.headline}`).join('; ') || "Review completed for large file.",
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