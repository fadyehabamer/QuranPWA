const fs = require('fs');
const path = require('path');
const https = require('https');

const SOURCE_BASE_URL = 'https://quran.ksu.edu.sa/png_big';
const MIN_PAGE = 1;
const MAX_PAGE = 604;
const CONCURRENCY = 6;
const TARGET_DIR = path.resolve(__dirname, '..', 'assets', 'mushaf-pages');
const FORCE_DOWNLOAD = process.argv.includes('--force');

function ensureTargetDirectory() {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
}

function getStreamWithRedirect(url, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        if (redirectCount > 5) {
            reject(new Error('Too many redirects'));
            return;
        }

        const request = https.get(url, {
            headers: {
                'User-Agent': 'QuranPWA-Mushaf-Downloader/1.0'
            }
        }, (response) => {
            const status = response.statusCode || 0;

            if (status >= 300 && status < 400 && response.headers.location) {
                const redirectUrl = new URL(response.headers.location, url).toString();
                response.resume();
                getStreamWithRedirect(redirectUrl, redirectCount + 1).then(resolve).catch(reject);
                return;
            }

            if (status !== 200) {
                response.resume();
                reject(new Error(`HTTP ${status}`));
                return;
            }

            resolve(response);
        });

        request.on('error', reject);
    });
}

async function downloadMushafPage(pageNumber) {
    const outputFile = path.join(TARGET_DIR, `${pageNumber}.png`);
    const tempFile = `${outputFile}.part`;

    if (!FORCE_DOWNLOAD && fs.existsSync(outputFile)) {
        return { pageNumber, status: 'skipped' };
    }

    const url = `${SOURCE_BASE_URL}/${pageNumber}.png`;
    const response = await getStreamWithRedirect(url);

    await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(tempFile);

        const cleanupOnError = (error) => {
            try {
                if (fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                }
            } catch (_cleanupError) {
                // Ignore cleanup errors.
            }
            reject(error);
        };

        response.on('error', cleanupOnError);
        writer.on('error', cleanupOnError);

        writer.on('finish', () => {
            writer.close((closeError) => {
                if (closeError) {
                    cleanupOnError(closeError);
                    return;
                }

                try {
                    fs.renameSync(tempFile, outputFile);
                    resolve();
                } catch (renameError) {
                    cleanupOnError(renameError);
                }
            });
        });

        response.pipe(writer);
    });

    return { pageNumber, status: 'downloaded' };
}

async function runWithConcurrency(items, worker, concurrency) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function runner() {
        while (true) {
            const current = nextIndex;
            nextIndex += 1;

            if (current >= items.length) {
                return;
            }

            const pageNumber = items[current];
            try {
                results[current] = await worker(pageNumber);
            } catch (error) {
                results[current] = {
                    pageNumber,
                    status: 'failed',
                    error: error instanceof Error ? error.message : String(error)
                };
            }
        }
    }

    const workerCount = Math.min(concurrency, items.length);
    const runners = Array.from({ length: workerCount }, () => runner());
    await Promise.all(runners);

    return results;
}

async function main() {
    ensureTargetDirectory();

    const pages = Array.from({ length: MAX_PAGE - MIN_PAGE + 1 }, (_, index) => MIN_PAGE + index);

    console.log('Preparing local Mushaf pages...');
    console.log(`Source: ${SOURCE_BASE_URL}`);
    console.log(`Target: ${TARGET_DIR}`);
    if (FORCE_DOWNLOAD) {
        console.log('Mode: force download (existing files will be replaced)');
    }

    const results = await runWithConcurrency(pages, async (pageNumber) => {
        const result = await downloadMushafPage(pageNumber);
        if (result.status === 'downloaded') {
            console.log(`[downloaded] ${pageNumber}.png`);
        } else {
            console.log(`[skipped] ${pageNumber}.png`);
        }
        return result;
    }, CONCURRENCY);

    const downloaded = results.filter(result => result.status === 'downloaded').length;
    const skipped = results.filter(result => result.status === 'skipped').length;
    const failed = results.filter(result => result.status === 'failed');

    console.log('---');
    console.log(`Downloaded: ${downloaded}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Failed: ${failed.length}`);

    if (failed.length > 0) {
        failed.forEach(item => {
            console.error(`[failed] ${item.pageNumber}.png -> ${item.error}`);
        });
        process.exitCode = 1;
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
