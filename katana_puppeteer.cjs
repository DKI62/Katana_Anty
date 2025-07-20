const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const ProxyChain = require('proxy-chain');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const profileName = process.argv[2];
const profilePath = path.join(__dirname, 'profiles', `${profileName}.json`);
const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));

const userAgent = profile.user_agent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

function log(...args) {
  const msg = '[Katana Debug] ' + args.join(' ');
  console.log(msg);
  fs.appendFileSync(path.join(__dirname, 'puppeteer_proxy_debug.log'), msg + '\n');
}

async function getProxyUrl(proxyUrl) {
  if (!proxyUrl) {
    log('Нет прокси в профиле');
    return null;
  }
  // ip:port:login:pass
  if (/^(\d{1,3}\.){3}\d{1,3}:\d+:[^:]+:[^:]+$/.test(proxyUrl)) {
    const [ip, port, login, pass] = proxyUrl.split(':');
    proxyUrl = `socks5://${login}:${pass}@${ip}:${port}`;
    log('Преобразовано из ip:port:login:pass:', proxyUrl);
  }
  // login:pass@ip:port
  else if (/^[^:]+:[^@]+@(\d{1,3}\.){3}\d{1,3}:\d+$/.test(proxyUrl)) {
    proxyUrl = `socks5://${proxyUrl}`;
    log('Преобразовано из login:pass@ip:port:', proxyUrl);
  }
  // socks5://login:pass@ip:port
  else if (/^socks5:\/\/[^:]+:[^@]+@(\d{1,3}\.){3}\d{1,3}:\d+$/.test(proxyUrl)) {
    log('Уже корректный socks5://login:pass@ip:port:', proxyUrl);
  }
  // ip:port
  else if (/^(\d{1,3}\.){3}\d{1,3}:\d+$/.test(proxyUrl)) {
    proxyUrl = `socks5://${proxyUrl}`;
    log('Преобразовано из ip:port:', proxyUrl);
  }
  else {
    log('Формат прокси нестандартный:', proxyUrl);
  }
  // Пробуем проксировать через proxy-chain
  try {
    const chained = await ProxyChain.anonymizeProxy(proxyUrl);
    log('proxy-chain вернул локальный адрес:', chained);
    return chained;
  } catch (err) {
    log('proxy-chain ошибка:', err && err.stack ? err.stack : err);
    return proxyUrl;
  }
}


(async () => {
  const proxyUrlRaw = profile.proxy || "";
  log('Запуск профиля:', profileName, 'Исходный proxy:', proxyUrlRaw);

  let puppeteerProxy = await getProxyUrl(proxyUrlRaw);

  log('Финальный proxy-server аргумент:', puppeteerProxy);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: false,
      executablePath: path.join(__dirname, 'chromium', 'chrome.exe'),
      args: [
        `--user-data-dir=${path.join(__dirname, 'profiles', profile.name)}`,
        puppeteerProxy ? `--proxy-server=${puppeteerProxy}` : '',
        `--user-agent=${userAgent}`,
        `--disable-extensions-except=${path.join(__dirname, 'extensions', 'katana_spoof')}`,
        `--load-extension=${path.join(__dirname, 'extensions', 'katana_spoof')}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-gpu',
        '--lang=en-US,en',
        '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
        '--enforce-webrtc-ip-permission-check',
        '--disable-webrtc-encryption',
        '--disable-webrtc-mdns',
        '--enable-features=WebRtcHideLocalIpsWithMdns',
        '--disable-features=WebRtcRemoteEventLog',
        '--enable-blink-features=GetUserMedia'
      ].filter(Boolean),
      ignoreDefaultArgs: ['--enable-automation'],
      defaultViewport: null
    });
  } catch (err) {
    log('ОШИБКА запуска браузера:', err && err.stack ? err.stack : err);
    process.exit(1);
  }

  const [page] = await browser.pages();
  await page.setUserAgent(userAgent);

  // Диагностика: пробуем открыть whoer.net и логируем все ошибки
  try {
    log('Открываем https://whoer.net для проверки');
    await page.goto('https://whoer.net', { waitUntil: 'domcontentloaded', timeout: 40000 });
    log('Страница whoer.net открыта');
  } catch (err) {
    log('Ошибка при открытии whoer.net:', err && err.stack ? err.stack : err);
  }

  console.log(`[+] Профиль ${profile.name} запущен!`);
})();
