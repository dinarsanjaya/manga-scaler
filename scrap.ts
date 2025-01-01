import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import ora from "ora";
import dotenv from "dotenv";

dotenv.config();

const {
  WAIFU2X_PATH = "~/Repos/tools/waifu2x/waifu2x-ncnn-vulkan",
  BASE_KOMIKU_URL = "https://komiku.id",
  OUTPUT_DIR = path.join(__dirname, "komik"),
  MIN_IMAGE_SIZE = "900",
  MAX_IMAGE_SIZE = "1024",
  NOISE_REDUCTION = "2",
  SCALE_FACTOR = "2",
} = process.env;

interface ImageData {
  src: string;
  alt: string;
}

/** Utility to ensure folder exists */
function ensureFolderExists(folderPath: string): void {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
}

/** Parse chapter number from URL */
function parseChapter(url: string): string {
  const chapterRaw = url
    .split("chapter-")[1]
    ?.split("-bahasa-indonesia")[0]
    ?.split("/")[0];
  const parts = chapterRaw.split("-");
  if (parts.length > 2) {
    return parts[0];
  }
  return chapterRaw || "unknown";
}

/** Fetch and scrape image data from a URL */
async function scrapeImages(url: string): Promise<ImageData[]> {
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    return $('img[itemprop="image"]')
      .map((_, el) => {
        const src = $(el).attr("src") || "";
        const alt = $(el).attr("alt") || "";
        return { src, alt };
      })
      .get();
  } catch (error) {
    console.error(`Error scraping images from ${url}:`, error);
    return [];
  }
}

/** Download an image */
async function downloadImage(url: string, outputPath: string): Promise<void> {
  try {
    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
    });
    await new Promise((resolve, reject) => {
      response.data
        .pipe(fs.createWriteStream(outputPath))
        .on("finish", resolve)
        .on("error", reject);
    });
  } catch (error) {
    console.error(`Error downloading image ${url}:`, error);
  }
}

/** Scale image using Waifu2x */
function scaleImage(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = `${WAIFU2X_PATH} -i "${inputPath}" -o "${outputPath}" -n ${NOISE_REDUCTION} -s ${SCALE_FACTOR}`;
    exec(command, (error) => (error ? reject(error) : resolve()));
  });
}

/** Check if images are already downloaded */
function areImagesComplete(folderPath: string, expectedCount: number): boolean {
  if (!fs.existsSync(folderPath)) return false;
  const files = fs
    .readdirSync(folderPath)
    .filter((file) => file.endsWith(".png"));
  return files.length === expectedCount;
}

/** Save image to a folder */
function getImageSavePath(
  comicName: string,
  chapter: string,
  fileName: string
): string {
  const folderPath = path.join(OUTPUT_DIR, comicName, chapter);
  ensureFolderExists(folderPath);
  return path.join(folderPath, fileName);
}

/** Process a single chapter */
async function processChapter(
  chapterUrl: string,
  comicTitle: string
): Promise<void> {
  const chapter = parseChapter(chapterUrl);
  console.log(`\nProcessing Chapter: ${chapter} of ${comicTitle}`);

  const images = await scrapeImages(chapterUrl);
  if (!images.length) {
    console.warn(`No images found for ${chapterUrl}`);
    return;
  }
  console.log(`Found ${images.length} images in chapter ${chapter}\n`);

  const folderPath = path.join(OUTPUT_DIR, comicTitle, chapter);

  if (areImagesComplete(folderPath, images.length)) {
    console.log(`Images for Chapter ${chapter} are already downloaded.`);
    return;
  }

  const spinner = ora(`Processing Chapter ${chapter}`).start();

  for (const [index, { src }] of images.entries()) {
    const rawFileName = `raw_image_${index + 1}.jpg`;
    const scaledFileName = `scaled_image_${index + 1}.png`;
    const skipScaledFileName = `scaled_image_${index + 1}_skip_.png`;

    const rawFilePath = getImageSavePath(comicTitle, chapter, rawFileName);
    const scaledFilePath = getImageSavePath(
      comicTitle,
      chapter,
      scaledFileName
    );
    const skipScaledFilePath = getImageSavePath(
      comicTitle,
      chapter,
      skipScaledFileName
    );

    try {
      spinner.text = `Downloading image ${index + 1} of ${images.length}...`;
      await downloadImage(src, rawFilePath);

      const rawSize = fs.statSync(rawFilePath).size;
      if (rawSize > parseInt(MIN_IMAGE_SIZE) * 1024) {
        spinner.text = `Image ${
          index + 1
        } is large enough, skipping scaling...`;
        fs.renameSync(rawFilePath, skipScaledFilePath);
      } else {
        spinner.text = `Scaling image ${index + 1} of ${images.length}...`;
        await scaleImage(rawFilePath, scaledFilePath);

        const scaledSize = fs.statSync(scaledFilePath).size;
        if (scaledSize < parseInt(MAX_IMAGE_SIZE) * 1024) {
          spinner.text = `Retrying scaling for image ${index + 1}...`;
          await scaleImage(rawFilePath, scaledFilePath);
        }

        fs.unlinkSync(rawFilePath);
      }
    } catch (error) {
      console.error(`Error processing image ${index + 1}:`, error);
    }
  }
  spinner.succeed(`Finished processing Chapter: ${chapter}`);
}

/** List chapters from a comic URL */
async function listChapters(comicUrl: string): Promise<string[]> {
  try {
    const { data } = await axios.get(comicUrl);
    const $ = cheerio.load(data);
    return $("td.judulseries a")
      .map((_, el) => $(el).attr("href") || "")
      .get()
      .map((href) => `${BASE_KOMIKU_URL}${href}`)
      .reverse();
  } catch (error) {
    console.error(`Error fetching chapters from ${comicUrl}:`, error);
    return [];
  }
}

/** Find chapter index by chapter string */
function findChapterIndex(chapters: string[], targetChapter: string): number {
  const cleanTarget = targetChapter.replace("chapter-", "");
  return chapters.findIndex((chapter) => parseChapter(chapter) === cleanTarget);
}

/** Main function */
(async () => {
  console.clear();
  console.log("Komiku Scrap + waifu2x Scale by @nataondev");

  const comicUrl = prompt("Enter the URL of the comic: ");
  if (!comicUrl || !comicUrl.includes("https://")) {
    console.error("Invalid comic URL.");
    return;
  }

  const comicTitle =
    comicUrl.split("manga/")[1]?.split("/")[0] || "unknown_comic";
  console.log(`Fetching chapters for: ${comicTitle}`);

  const chapters = await listChapters(comicUrl);
  if (!chapters.length) {
    console.error(`No chapters found for ${comicUrl}`);
    return;
  }

  console.log(`Found ${chapters.length} index chapters:`);
  chapters.forEach((chapter) => {
    console.log(`- ${parseChapter(chapter)}`);
  });

  const targetChapter = prompt("\nEnter the chapter (e.g., 35.1 or 35-1): ");
  const formattedChapter = targetChapter?.replace(".", "-") || "";
  const startIndex = findChapterIndex(chapters, `chapter-${formattedChapter}`);

  if (startIndex === -1) {
    console.error("Chapter not found.");
    return;
  }

  const totalChapters = chapters.length - startIndex;
  const howMany = parseInt(
    prompt(`How many chapters to download? (default: ${totalChapters}): `) ||
      `${totalChapters}`
  );
  if (isNaN(howMany) || howMany < 1) {
    console.error("Invalid number of chapters.");
    return;
  }

  console.log(
    `Downloading ${howMany} chapters starting from Chapter ${formattedChapter}...`
  );
  for (
    let i = startIndex;
    i < Math.min(startIndex + howMany, chapters.length);
    i++
  ) {
    await processChapter(chapters[i], comicTitle);
  }
})();
