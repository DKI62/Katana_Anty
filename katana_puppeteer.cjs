const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const profileName = process.argv[2];
const profilePath = path.join(__dirname, 'profiles', `${profileName}.json`);
const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));

const userAgent = profile.user_agent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: path.join(__dirname, 'chromium', 'chrome.exe'),
    args: [
      `--user-data-dir=${path.join(__dirname, 'profiles', profile.name)}`,
      profile.proxy ? `--proxy-server=${profile.proxy}` : '',
      `--user-agent=${userAgent}`,
      `--disable-extensions-except=${path.join(__dirname, 'extensions', 'katana_spoof')}`,
      `--load-extension=${path.join(__dirname, 'extensions', 'katana_spoof')}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-gpu',
      '--lang=en-US,en',

      // WebRTC
      '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
      '--enforce-webrtc-ip-permission-check',
      '--disable-webrtc-encryption',
      '--disable-webrtc-mdns',
      '--enable-features=WebRtcHideLocalIpsWithMdns',
      '--disable-features=WebRtcRemoteEventLog',

      // Время
      '--enable-blink-features=GetUserMedia'
    ].filter(Boolean),
    ignoreDefaultArgs: ['--enable-automation'],
    defaultViewport: null
  });

  const [page] = await browser.pages();

  await page.setUserAgent(userAgent);

  console.log(`[+] Профиль ${profile.name} запущен!`);
})();
