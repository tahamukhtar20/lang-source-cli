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

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { logger } from '../utils';

/**
 * @class GenerateTranslations
 * @description This class generates translations for supported languages using the OpenAI Language Model API.
 */
class GenerateTranslations {
  public static readonly supportedLanguagesText = new Map([
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
  private readonly apiKey: string;
  private readonly maxTokens: number;
  private readonly temperature: number;
  private readonly supportedLanguages: string[];
  private filePath: string;

  /**
   * Constructs a new instance of the GenerateTranslations class.
   * @param {string} filePath - The folder containing the translation files.
   * @throws {Error} If the API key is missing.
   */
  constructor(filePath: string) {
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
  private generatePrompt(
    baseData: Record<string, string>,
    targetLang: string,
  ): string {
    const targetLangText =
      GenerateTranslations.supportedLanguagesText.get(targetLang) ?? targetLang;

    const promptBuilder = new Array<string>();
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
  private extractJSON(text: string): Record<string, string> {
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}') + 1;
    const jsonString = text.substring(jsonStart, jsonEnd);
    return JSON.parse(jsonString);
  }

  /**
   * Generates translation files for supported languages.
   * @throws {Error} If the base translation file is not found or if translation generation fails.
   */
  public async generateTranslations(
    languageList: string[] = this.supportedLanguages,
  ): Promise<void> {
    const baseFilePath = path.join(this.filePath);
    const baseContent = fs.readFileSync(baseFilePath, 'utf-8');
    let baseData: Record<string, string>;

    try {
      baseData = JSON.parse(baseContent);
    } catch (error) {
      throw new Error(
        `Failed to parse (${this.filePath}): ${(error as Error).message}`,
      );
    }

    logger.info(`Starting translation generation from (${this.filePath})`);

    const retryRequest = async (
      lang: string,
      maxRetries: number,
    ): Promise<void> => {
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
          const response = await axios.post(url, data, { headers });

          if (!response || !response.data) {
            throw new Error(
              'Failed to generate translation: No response data.',
            );
          }

          const translations = this.extractJSON(
            response.data.candidates[0].content.parts[0].text.trim(),
          );
          const fileName = `${lang}.json`;
          if (fileName === path.basename(this.filePath)) {
            logger.info(
              `Skipping translation for ${lang}.json as it is the same as the base file.`,
            );
            return;
          }
          const directory = path.dirname(this.filePath);
          const filePath = path.join(directory, fileName);
          fs.writeFileSync(filePath, JSON.stringify(translations, null, 2));
          logger.info(`${lang}.json generated successfully.`);
          return;
        } catch (error) {
          attempts++;
          if (attempts <= maxRetries) {
            logger.warn(
              `Retrying (${attempts}/${maxRetries}) for ${lang}.json due to error: ${
                (error as Error).message
              }`,
            );
            await new Promise((resolve) => setTimeout(resolve, 3000));
          } else {
            logger.error(
              `Failed to generate ${lang}.json after ${maxRetries} attempts.`,
            );
            throw error;
          }
        }
      }
    };

    const translationPromises = languageList.map((lang) => {
      return retryRequest(lang, 3);
    });

    try {
      await Promise.all(translationPromises);
      logger.info('Translation complete.');
    } catch (error) {
      logger.error(
        'Translation generation failed for some or all languages:',
        error,
      );
    }
  }
}

export { GenerateTranslations };
