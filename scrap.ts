import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import ora from "ora";
import dotenv from "dotenv";
import type { Ora } from "ora";

dotenv.config();

// Constants
const CONFIG = {
  WAIFU2X_PATH:
    process.env.WAIFU2X_PATH || "~/Repos/tools/waifu2x/waifu2x-ncnn-vulkan",
  BASE_KOMIKU_URL: process.env.BASE_KOMIKU_URL || "https://komiku.org",
  OUTPUT_DIR: process.env.OUTPUT_DIR || path.join(__dirname, "komik"),
  MIN_IMAGE_SIZE: parseInt(process.env.MIN_IMAGE_SIZE || "900"),
  MAX_IMAGE_SIZE: parseInt(process.env.MAX_IMAGE_SIZE || "1024"),
  NOISE_REDUCTION: process.env.NOISE_REDUCTION || "2",
  SCALE_FACTOR: process.env.SCALE_FACTOR || "2",
  HISTORY_FILE: path.join(__dirname, "history.txt"),
  MAX_HISTORY: 10,
} as const;

// Types
interface ImageData {
  src: string;
  alt: string;
}

interface ComicHistory {
  url: string;
  title: string;
  lastAccessed: string;
}

// History Management
class HistoryManager {
  private history: ComicHistory[] = [];

  constructor() {
    this.loadHistory();
  }

  private loadHistory(): void {
    try {
      if (fs.existsSync(CONFIG.HISTORY_FILE)) {
        const data = fs.readFileSync(CONFIG.HISTORY_FILE, "utf8");
        this.history = JSON.parse(data);
      }
    } catch (error) {
      console.error("Error loading history:", error);
      this.history = [];
    }
  }

  private saveHistory(): void {
    try {
      fs.writeFileSync(
        CONFIG.HISTORY_FILE,
        JSON.stringify(this.history, null, 2)
      );
    } catch (error) {
      console.error("Error saving history:", error);
    }
  }

  addToHistory(url: string, title: string): void {
    const existingIndex = this.history.findIndex((h) => h.url === url);
    const newEntry = { url, title, lastAccessed: new Date().toISOString() };

    if (existingIndex !== -1) {
      this.history.splice(existingIndex, 1);
    }

    this.history.unshift(newEntry);
    if (this.history.length > CONFIG.MAX_HISTORY) {
      this.history.pop();
    }

    this.saveHistory();
  }

  getHistory(): ComicHistory[] {
    return this.history;
  }

  showHistory(): void {
    if (this.history.length === 0) {
      console.log("No history found.");
      return;
    }

    console.log("\nRecent Comics:");
    this.history.forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.title} (${entry.url})`);
    });
  }

  getUrlByIndex(index: number): string | null {
    return this.history[index - 1]?.url || null;
  }
}

// Utility Functions
const utils = {
  ensureFolderExists(folderPath: string): void {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
  },

  parseChapter(url: string): string {
    const chapterRaw = url
      .split("chapter-")[1]
      ?.split("-bahasa-indonesia")[0]
      ?.split("/")[0];
    const parts = chapterRaw?.split("-") || [];
    return parts.length > 2 ? parts[0] : chapterRaw || "unknown";
  },

  getImageSavePath(
    comicName: string,
    chapter: string,
    fileName: string
  ): string {
    const folderPath = path.join(CONFIG.OUTPUT_DIR, comicName, chapter);
    utils.ensureFolderExists(folderPath);
    return path.join(folderPath, fileName);
  },

  areImagesComplete(folderPath: string, expectedCount: number): boolean {
    if (!fs.existsSync(folderPath)) return false;
    const files = fs
      .readdirSync(folderPath)
      .filter((file) => file.endsWith(".png"));
    return files.length === expectedCount;
  },

  getDownloadedChapters(comicTitle: string): string[] {
    const comicPath = path.join(CONFIG.OUTPUT_DIR, comicTitle);
    if (!fs.existsSync(comicPath)) return [];

    try {
      return fs
        .readdirSync(comicPath)
        .filter((folder) => {
          // Pastikan ini adalah folder chapter yang valid
          const folderPath = path.join(comicPath, folder);
          return (
            fs.statSync(folderPath).isDirectory() &&
            fs.readdirSync(folderPath).some((file) => file.endsWith(".png"))
          );
        })
        .sort((a, b) => {
          // Sort berdasarkan nomor chapter
          const numA = parseFloat(a.replace("-", ".")) || 0;
          const numB = parseFloat(b.replace("-", ".")) || 0;
          return numA - numB;
        });
    } catch (error) {
      console.error(`Error reading downloaded chapters: ${error}`);
      return [];
    }
  },

  getNextChapterIndex(
    chapters: string[],
    lastDownloadedChapter: string
  ): number {
    // Cari indeks chapter terakhir yang diunduh
    const lastDownloadedChapterClean = lastDownloadedChapter.replace("-", ".");

    for (let i = 0; i < chapters.length; i++) {
      const currentChapter = utils.parseChapter(chapters[i]);
      const currentChapterClean = currentChapter.replace("-", ".");

      // Jika menemukan chapter yang nomor chapter-nya lebih besar dari terakhir diunduh
      if (
        parseFloat(currentChapterClean) > parseFloat(lastDownloadedChapterClean)
      ) {
        return i;
      }
    }

    // Jika tidak menemukan chapter berikutnya (misal sudah mengunduh yang terbaru)
    return -1;
  },

  formatChapterDisplay(chapter: string, isDownloaded: boolean): string {
    return `${chapter}${isDownloaded ? " ✓" : ""}`;
  },
};

// API Functions
const api = {
  async scrapeImages(url: string): Promise<ImageData[]> {
    try {
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);
      return $('img[itemprop="image"]')
        .map((_, el) => ({
          src: $(el).attr("src") || "",
          alt: $(el).attr("alt") || "",
        }))
        .get();
    } catch (error) {
      console.error(`Error scraping images from ${url}:`, error);
      return [];
    }
  },

  async downloadImage(url: string, outputPath: string): Promise<void> {
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
  },

  async listChapters(comicUrl: string): Promise<string[]> {
    try {
      const { data } = await axios.get(comicUrl);
      const $ = cheerio.load(data);
      return $("td.judulseries a")
        .map((_, el) => $(el).attr("href") || "")
        .get()
        .map((href) => `${CONFIG.BASE_KOMIKU_URL}${href}`)
        .reverse();
    } catch (error) {
      console.error(`Error fetching chapters from ${comicUrl}:`, error);
      return [];
    }
  },

  async getComicTitle(comicUrl: string): Promise<string> {
    try {
      const { data } = await axios.get(comicUrl);
      const $ = cheerio.load(data);
      const title = $("h1.judul").text().trim();
      return (
        title || comicUrl.split("manga/")[1]?.split("/")[0] || "unknown_comic"
      );
    } catch (error) {
      console.error(`Error fetching comic title: ${error}`);
      return comicUrl.split("manga/")[1]?.split("/")[0] || "unknown_comic";
    }
  },
};

// Image Processing
class ImageProcessor {
  static scaleImage(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = `${CONFIG.WAIFU2X_PATH} -i "${inputPath}" -o "${outputPath}" -n ${CONFIG.NOISE_REDUCTION} -s ${CONFIG.SCALE_FACTOR}`;
      exec(command, (error) => (error ? reject(error) : resolve()));
    });
  }

  static async processImage(
    src: string,
    index: number,
    comicTitle: string,
    chapter: string,
    spinner: Ora
  ): Promise<void> {
    const rawFileName = `raw_image_${index + 1}.jpg`;
    const scaledFileName = `scaled_image_${index + 1}.png`;
    const skipScaledFileName = `scaled_image_${index + 1}_skip_.png`;

    const rawFilePath = utils.getImageSavePath(
      comicTitle,
      chapter,
      rawFileName
    );
    const scaledFilePath = utils.getImageSavePath(
      comicTitle,
      chapter,
      scaledFileName
    );
    const skipScaledFilePath = utils.getImageSavePath(
      comicTitle,
      chapter,
      skipScaledFileName
    );

    try {
      spinner.text = `Downloading image ${index + 1}...`;
      await api.downloadImage(src, rawFilePath);

      const rawSize = fs.statSync(rawFilePath).size;
      if (rawSize > CONFIG.MIN_IMAGE_SIZE * 1024) {
        spinner.text = `Image ${
          index + 1
        } is large enough, skipping scaling...`;
        fs.renameSync(rawFilePath, skipScaledFilePath);
      } else {
        spinner.text = `Scaling image ${index + 1}...`;
        await this.scaleImage(rawFilePath, scaledFilePath);

        const scaledSize = fs.statSync(scaledFilePath).size;
        if (scaledSize < CONFIG.MAX_IMAGE_SIZE * 1024) {
          spinner.text = `Retrying scaling for image ${index + 1}...`;
          await this.scaleImage(rawFilePath, scaledFilePath);
        }

        fs.unlinkSync(rawFilePath);
      }
    } catch (error) {
      console.error(`Error processing image ${index + 1}:`, error);
    }
  }
}

// Comic Processor
class ComicProcessor {
  private historyManager: HistoryManager;

  constructor() {
    this.historyManager = new HistoryManager();
  }

  async processChapter(chapterUrl: string, comicTitle: string): Promise<void> {
    const chapter = utils.parseChapter(chapterUrl);
    console.log(`\nProcessing Chapter: ${chapter} of ${comicTitle}`);

    const images = await api.scrapeImages(chapterUrl);
    if (!images.length) {
      console.warn(`No images found for ${chapterUrl}`);
      return;
    }

    const folderPath = path.join(CONFIG.OUTPUT_DIR, comicTitle, chapter);
    if (utils.areImagesComplete(folderPath, images.length)) {
      console.log(`Images for Chapter ${chapter} are already downloaded.`);
      return;
    }

    const spinner = ora(`Processing Chapter ${chapter}`).start();
    for (const [index, { src }] of images.entries()) {
      await ImageProcessor.processImage(
        src,
        index,
        comicTitle,
        chapter,
        spinner
      );
    }
    spinner.succeed(`Finished processing Chapter: ${chapter}`);
  }

  findChapterIndex(chapters: string[], targetChapter: string): number {
    const cleanTarget = targetChapter.replace("chapter-", "");
    return chapters.findIndex(
      (chapter) => utils.parseChapter(chapter) === cleanTarget
    );
  }

  displayChaptersInfo(chapters: string[], comicTitle: string): void {
    const downloadedChapters = utils.getDownloadedChapters(comicTitle);

    if (downloadedChapters.length > 0) {
      const lastTenChapters = downloadedChapters.slice(-10);
      const lastChapter = downloadedChapters[downloadedChapters.length - 1];
      const nextChapterIndex = utils.getNextChapterIndex(chapters, lastChapter);

      console.log(`\n┌─────────────────────────────┐`);
      console.log(`│ 💾 CHAPTER TERUNDUH (${downloadedChapters.length})     │`);
      console.log(`└─────────────────────────────┘`);

      if (lastTenChapters.length > 0) {
        lastTenChapters.forEach((chapter) => {
          console.log(`   • Chapter ${chapter} ✓`);
        });

        if (downloadedChapters.length > 10) {
          console.log(
            `   • ... dan ${downloadedChapters.length - 10} chapter lainnya`
          );
        }
      }

      // Tampilkan chapter terakhir yang diunduh dan chapter berikutnya
      if (lastChapter) {
        console.log(
          `\n📌 Chapter terakhir yang diunduh: Chapter ${lastChapter}`
        );

        if (nextChapterIndex !== -1) {
          const nextChapter = utils.parseChapter(chapters[nextChapterIndex]);
          console.log(`📥 Chapter berikutnya tersedia: Chapter ${nextChapter}`);
        } else {
          console.log(`✅ Semua chapter sudah diunduh!`);
        }
      }
    } else {
      console.log(`\n❗ Belum ada chapter yang diunduh`);
      console.log(`💡 Total chapter tersedia: ${chapters.length}`);
      console.log(
        `💡 Chapter pertama: Chapter ${utils.parseChapter(chapters[0])}`
      );
      console.log(
        `💡 Chapter terakhir: Chapter ${utils.parseChapter(
          chapters[chapters.length - 1]
        )}`
      );
    }
  }

  async start(): Promise<void> {
    console.clear();
    console.log(`
┌───────────────────────────────────────────┐
│                                           │
│  KOMIKU SCRAP + WAIFU2X SCALE             │
│  by @nataondev                            │
│                                           │
└───────────────────────────────────────────┘
    `);

    this.historyManager.showHistory();

    const historyChoice = prompt(
      "\nMasukkan nomor history atau paste URL baru: "
    );
    if (!historyChoice) {
      console.error("Tidak ada input yang diberikan");
      return;
    }

    let comicUrl = "";
    if (/^\d+$/.test(historyChoice)) {
      const historyUrl = this.historyManager.getUrlByIndex(
        parseInt(historyChoice)
      );
      if (!historyUrl) {
        console.error("Indeks history tidak valid.");
        return;
      }
      comicUrl = historyUrl;
    } else {
      comicUrl = historyChoice;
    }

    if (!comicUrl.includes("https://")) {
      console.error("URL komik tidak valid.");
      return;
    }

    console.log(`\n🔍 Mengambil informasi komik...`);
    const comicTitle = await api.getComicTitle(comicUrl);
    this.historyManager.addToHistory(comicUrl, comicTitle);

    console.log(`\n📚 Judul Komik: ${comicTitle}`);
    console.log(`🔄 Mengambil daftar chapter...`);
    const chapters = await api.listChapters(comicUrl);

    if (!chapters.length) {
      console.error(`❌ Tidak ada chapter yang ditemukan untuk ${comicUrl}`);
      return;
    }

    console.log(`\n✅ Ditemukan ${chapters.length} chapter total`);
    this.displayChaptersInfo(chapters, comicTitle);

    // Cek apakah ada chapter terakhir yang diunduh
    const downloadedChapters = utils.getDownloadedChapters(comicTitle);
    const lastDownloadedChapter =
      downloadedChapters.length > 0
        ? downloadedChapters[downloadedChapters.length - 1]
        : null;

    // Cari chapter berikutnya setelah chapter terakhir yang diunduh
    let nextChapterIndex = -1;
    if (lastDownloadedChapter) {
      nextChapterIndex = utils.getNextChapterIndex(
        chapters,
        lastDownloadedChapter
      );
    }

    // Opsi unduhan
    console.log(`\nOpsi Download:`);
    console.log(`1. Unduh dari chapter tertentu`);

    // Tampilkan opsi lanjutkan unduhan hanya jika ada chapter terakhir dan ada chapter berikutnya
    if (lastDownloadedChapter && nextChapterIndex !== -1) {
      const nextChapter = utils.parseChapter(chapters[nextChapterIndex]);
      console.log(
        `2. Lanjutkan unduhan dari Chapter ${nextChapter} (setelah Chapter ${lastDownloadedChapter})`
      );
    } else if (lastDownloadedChapter) {
      console.log(`2. [Tidak tersedia] Semua chapter sudah diunduh`);
    } else {
      console.log(`2. [Tidak tersedia] Belum ada chapter yang diunduh`);
    }

    const downloadOption = prompt("\nPilih opsi (1/2): ");
    if (!downloadOption) {
      console.error("Tidak ada opsi yang dipilih");
      return;
    }

    let startIndex = 0;
    let targetChapter = "";

    if (downloadOption === "2") {
      // Lanjutkan unduhan dari chapter terakhir
      if (lastDownloadedChapter && nextChapterIndex !== -1) {
        startIndex = nextChapterIndex;
        targetChapter = utils.parseChapter(chapters[nextChapterIndex]);
        console.log(
          `\n📥 Melanjutkan unduhan dari Chapter ${targetChapter} (setelah Chapter ${lastDownloadedChapter})`
        );
      } else {
        console.error(
          "Opsi tidak tersedia. Tidak ada chapter berikutnya untuk diunduh."
        );
        return;
      }
    } else {
      // Unduh dari chapter tertentu
      const chapterInput = prompt(
        "\nMasukkan chapter (contoh: 35.1 atau 35-1): "
      );
      if (!chapterInput) {
        console.error("Tidak ada chapter yang diberikan");
        return;
      }

      targetChapter = chapterInput;
      const formattedChapter = targetChapter.replace(".", "-");
      startIndex = this.findChapterIndex(
        chapters,
        `chapter-${formattedChapter}`
      );

      if (startIndex === -1) {
        console.error("Chapter tidak ditemukan.");
        return;
      }
    }

    const totalChapters = chapters.length - startIndex;
    const howManyInput = prompt(
      `Berapa chapter yang ingin diunduh? (default: ${totalChapters}): `
    );
    const howMany = parseInt(howManyInput || `${totalChapters}`);

    if (isNaN(howMany) || howMany < 1) {
      console.error("Jumlah chapter tidak valid.");
      return;
    }

    console.log(
      `\n📥 Mengunduh ${howMany} chapter dimulai dari Chapter ${targetChapter}...`
    );

    for (
      let i = startIndex;
      i < Math.min(startIndex + howMany, chapters.length);
      i++
    ) {
      await this.processChapter(chapters[i], comicTitle);
    }

    console.log(`\n✅ Semua download selesai!`);
  }
}

// Run the application
new ComicProcessor().start();
