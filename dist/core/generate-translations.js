'use strict';
/**
 * @license MIT
 *
 * Copyright (c) 2025 lang-source
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:npm run check-license

 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
*/
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator['throw'](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.GenerateTranslations = void 0;
const fs_1 = __importDefault(require('fs'));
const path_1 = __importDefault(require('path'));
const axios_1 = __importDefault(require('axios'));
const utils_1 = require('../utils');
/**
 * @class GenerateTranslations
 * @description This class generates translations for supported languages using the OpenAI Language Model API.
 */
class GenerateTranslations {
  /**
   * Constructs a new instance of the GenerateTranslations class.
   * @param {string} filePath - The folder containing the translation files.
   * @throws {Error} If the API key is missing.
   */
  constructor(filePath) {
    this.filePath = filePath;
    this.supportedLanguages = Array.from(
      GenerateTranslations.supportedLanguagesText.keys(),
    );
    this.maxTokens = 3000;
    this.temperature = 0.4;
    this.apiKey = process.env.LANGSOURCE_API_KEY || '';
    if (!this.apiKey) {
      throw new Error(
        'Missing API key. Please set the LANGSOURCE_API_KEY environment variable.',
      );
    }
  }
  /**
   * Generates a prompt for translating a JSON object into a target language.
   * @param {Record<string, string>} baseData - The base translations as key-value pairs.
   * @param {string} targetLang - The target language for translation.
   * @returns {string} A formatted prompt string.
   */
  generatePrompt(baseData, targetLang) {
    var _a;
    const targetLangText =
      (_a = GenerateTranslations.supportedLanguagesText.get(targetLang)) !==
        null && _a !== void 0
        ? _a
        : targetLang;
    const promptBuilder = new Array();
    promptBuilder.push(
      'Your task is to translate the values of a given JSON file into the specified target language, without changing the structure or keys of the JSON. Follow these guidelines:',
    );
    promptBuilder.push(
      '1. If the target language is the same as the current language of the JSON values, return the original JSON.',
    );
    promptBuilder.push(
      '2. Do not translate URLs, code, names, path names, or any other text that should not be translated.',
    );
    promptBuilder.push(
      '3. Maintain the original JSON format without any additional text.',
    );
    promptBuilder.push(
      '4. If a value is not translatable or should not be translated, you can leave it as is.',
    );
    promptBuilder.push(
      `Here is the JSON file and you need to translate it into ${targetLangText}:`,
    );
    promptBuilder.push(`"""`);
    promptBuilder.push(`${JSON.stringify(baseData, null, 2)}`);
    promptBuilder.push(`"""`);
    promptBuilder.push(
      'Your output should adhere to the format below without any additional text:',
    );
    promptBuilder.push(`{`);
    promptBuilder.push(`  "key1": "translated_value1",`);
    promptBuilder.push(`  "key2": "translated_value2",`);
    promptBuilder.push(`  "key3": {`);
    promptBuilder.push(`    "key4": "translated_value3"`);
    promptBuilder.push(`  }`);
    promptBuilder.push(`}`);
    return promptBuilder.join('\n');
  }
  /**
   * Extracts the JSON content from the generated translation.
   * @param {string} text - The generated translation text.
   * @returns {Record<string, string>} The extracted JSON content.
   */
  extractJSON(text) {
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}') + 1;
    const jsonString = text.substring(jsonStart, jsonEnd);
    return JSON.parse(jsonString);
  }
  /**
   * Generates translation files for supported languages.
   * @throws {Error} If the base translation file is not found or if translation generation fails.
   */
  generateTranslations() {
    return __awaiter(
      this,
      arguments,
      void 0,
      function* (languageList = this.supportedLanguages) {
        const baseFilePath = path_1.default.join(this.filePath);
        const baseContent = fs_1.default.readFileSync(baseFilePath, 'utf-8');
        let baseData;
        try {
          baseData = JSON.parse(baseContent);
        } catch (error) {
          throw new Error(
            `Failed to parse (${this.filePath}): ${error.message}`,
          );
        }
        utils_1.logger.info(
          `Starting translation generation from (${this.filePath})`,
        );
        const retryRequest = (lang, maxRetries) =>
          __awaiter(this, void 0, void 0, function* () {
            let attempts = 0;
            const headers = {
              'Content-Type': 'application/json',
            };
            const data = {
              contents: [
                {
                  parts: [
                    {
                      text: this.generatePrompt(baseData, lang),
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: this.temperature,
                maxOutputTokens: this.maxTokens,
              },
            };
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
            while (attempts <= maxRetries) {
              try {
                const response = yield axios_1.default.post(url, data, {
                  headers,
                });
                if (!response || !response.data) {
                  throw new Error(
                    'Failed to generate translation: No response data.',
                  );
                }
                const translations = this.extractJSON(
                  response.data.candidates[0].content.parts[0].text.trim(),
                );
                const fileName = `${lang}.json`;
                if (fileName === path_1.default.basename(this.filePath)) {
                  utils_1.logger.info(
                    `Skipping translation for ${lang}.json as it is the same as the base file.`,
                  );
                  return;
                }
                const directory = path_1.default.dirname(this.filePath);
                const filePath = path_1.default.join(directory, fileName);
                fs_1.default.writeFileSync(
                  filePath,
                  JSON.stringify(translations, null, 2),
                );
                utils_1.logger.info(`${lang}.json generated successfully.`);
                return;
              } catch (error) {
                attempts++;
                if (attempts <= maxRetries) {
                  utils_1.logger.warn(
                    `Retrying (${attempts}/${maxRetries}) for ${lang}.json due to error: ${error.message}`,
                  );
                  yield new Promise((resolve) => setTimeout(resolve, 3000));
                } else {
                  utils_1.logger.error(
                    `Failed to generate ${lang}.json after ${maxRetries} attempts.`,
                  );
                  throw error;
                }
              }
            }
          });
        const translationPromises = languageList.map((lang) => {
          return retryRequest(lang, 3);
        });
        try {
          yield Promise.all(translationPromises);
          utils_1.logger.info('Translation complete.');
        } catch (error) {
          utils_1.logger.error(
            'Translation generation failed for some or all languages:',
            error,
          );
        }
      },
    );
  }
}
exports.GenerateTranslations = GenerateTranslations;
GenerateTranslations.supportedLanguagesText = new Map([
  ['en', 'English'],
  ['ja', 'Japanese'],
  ['ko', 'Korean'],
  ['ru', 'Russian'],
  ['pt', 'Portuguese'],
  ['ar', 'Arabic'],
  ['de', 'German'],
  ['fr', 'French'],
  ['es', 'Spanish'],
  ['it', 'Italian'],
  ['zh', 'Chinese'],
  ['ur', 'Urdu'],
]);
