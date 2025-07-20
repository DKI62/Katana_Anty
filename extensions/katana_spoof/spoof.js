(async function () {
  const DEBUG = true;
  const log = (...args) => DEBUG && console.log('[Katana] 🛡️', ...args);

  let locale = 'en-US';
  let timezone = 'America/New_York';
  let offset = 240;

  try {
    const res = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    locale = data.languages?.split(',')[0] || 'en-US';
    timezone = data.timezone || 'America/New_York';
    const match = data.utc_offset?.match(/([+-])(\d{2})(\d{2})/);
    if (match) {
      const [, sign, h, m] = match;
      offset = (sign === '+' ? -1 : 1) * (parseInt(h) * 60 + parseInt(m));
    }
  } catch (e) {
    log('⚠️ Failed to fetch IP data, using defaults');
  }

  // --- Date Spoof (No max stack errors, only shift for now) ---
  const RealDate = Date;
  const getFakeTime = () => {
    const now = new RealDate();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new RealDate(utc - offset * 60000);
  };

  class FakeDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(getFakeTime().getTime());
      else super(...args);
    }
    static now() { return getFakeTime().getTime(); }
    getTimezoneOffset() { return offset; }
    toString() { return getFakeTime().toString(); }
    toLocaleString(...args) { return getFakeTime().toLocaleString(locale, ...args.slice(1)); }
    toLocaleDateString(...args) { return getFakeTime().toLocaleDateString(locale, ...args.slice(1)); }
    toLocaleTimeString(...args) { return getFakeTime().toLocaleTimeString(locale, ...args.slice(1)); }
  }
  FakeDate.prototype = RealDate.prototype;
  window.Date = FakeDate;

  // --- Intl API Hard Spoof ---
  function hardSpoofIntl() {
    const forceLocale = (Original) =>
      new Proxy(Original, {
        construct(target, args, newTarget) {
          args[0] = locale;
          if (args[1]) args[1].timeZone = timezone;
          return Reflect.construct(target, args, newTarget);
        }
      });

    const patchResolved = (proto, moreFields = {}) => {
      const orig = proto.resolvedOptions;
      proto.resolvedOptions = function () {
        const res = orig.apply(this);
        res.locale = locale;
        if ('timeZone' in res) res.timeZone = timezone;
        Object.assign(res, moreFields);
        return res;
      };
    };

    [
      'DateTimeFormat', 'NumberFormat', 'Collator',
      'RelativeTimeFormat', 'PluralRules', 'ListFormat',
      'Segmenter', 'DisplayNames'
    ].forEach(cls => {
      if (Intl[cls]) Intl[cls] = forceLocale(Intl[cls]);
      if (Intl[cls]?.prototype?.resolvedOptions) patchResolved(Intl[cls].prototype);
    });

    Intl.getCanonicalLocales = () => [locale];

    // DisplayNames.format & formatToParts тоже спуфим
    if (Intl.NumberFormat?.prototype.formatToParts) {
      const origNFormat = Intl.NumberFormat.prototype.formatToParts;
      Intl.NumberFormat.prototype.formatToParts = function (...args) {
        const parts = origNFormat.apply(this, args);
        return parts.map(p => {
          if (p.type === 'currency') p.value = '$';
          if (p.type === 'decimal') p.value = '.';
          if (p.type === 'group') p.value = ',';
          return p;
        });
      };
    }
  }
  hardSpoofIntl();

  // --- Language / Accept-Language ---
  Object.defineProperty(navigator, 'language', { get: () => locale, configurable: true });
  Object.defineProperty(navigator, 'languages', { get: () => [locale, locale.split('-')[0]], configurable: true });
  Object.defineProperty(navigator, 'userLanguage', { get: () => locale, configurable: true });
  Object.defineProperty(navigator, 'acceptLanguages', {
    get: () => [locale, locale.split('-')[0]], configurable: true
  });

  // --- SpeechSynthesis filter RU voices ---
  if (window.speechSynthesis) {
    const origGetVoices = speechSynthesis.getVoices.bind(speechSynthesis);
    speechSynthesis.getVoices = () => {
      return origGetVoices().filter(v => {
        // Жёсткая фильтрация по lang, name, voiceURI, всему что связано с ru
        const s = (v.lang + v.voiceURI + v.name).toLowerCase();
        return !s.includes('ru') && !s.includes('ирина') && !s.includes('pavel') && !s.includes('русский');
      });
    };
  }

  // --- Hardware spoof ---
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8, configurable: true });
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 8, configurable: true });
  Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 1, configurable: true });

  // --- Plugins/mimeTypes spoof ---
  Object.defineProperty(navigator, 'plugins', {
    get: () => ({ length: 0, item: () => null, namedItem: () => null }), configurable: true
  });
  Object.defineProperty(navigator, 'mimeTypes', {
    get: () => ({ length: 0, item: () => null, namedItem: () => null }), configurable: true
  });

  // --- Canvas spoof ---
  const getImageData = CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData = function (...args) {
    const imageData = getImageData.apply(this, args);
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] ^= 1;
      imageData.data[i + 1] ^= 1;
      imageData.data[i + 2] ^= 1;
    }
    return imageData;
  };

  // --- WebGL spoof ---
  const getParameter = WebGLRenderingContext.prototype.getParameter;
  const safeWebGLParams = {
    37445: "NVIDIA Corporation",
    37446: "NVIDIA GeForce RTX 3060",
    7936: "WebGL",
    7937: "WebGL Renderer",
    33901: 16384,
  };
  WebGLRenderingContext.prototype.getParameter = function (param) {
    if (safeWebGLParams.hasOwnProperty(param)) return safeWebGLParams[param];
    try { return getParameter.call(this, param); }
    catch (e) { return null; }
  };

  // --- Audio spoof ---
  const origAudio = AudioBuffer.prototype.getChannelData;
  AudioBuffer.prototype.getChannelData = function (...args) {
    const data = origAudio.apply(this, args);
    for (let i = 0; i < data.length; i++) {
      data[i] += 0.00001 * Math.sin(i);
    }
    return data;
  };

  Object.defineProperty(AudioContext.prototype, 'sampleRate', {
    get: function () { return 44100; },
    configurable: true,
  });

  // --- WebRTC spoof ---
  class FakeRTCPeerConnection {
    constructor() {
      this.iceGatheringState = "complete";
      this.connectionState = "connected";
      this.signalingState = "stable";
    }
    createDataChannel() { return {}; }
    addIceCandidate() { return Promise.resolve(); }
    createOffer() {
      return Promise.resolve({ type: "offer", sdp: "v=0\r\no=- 0 0 IN IP4 0.0.0.0\r\ns=-\r\nc=IN IP4 0.0.0.0\r\nt=0 0\r\n" });
    }
    createAnswer() { return this.createOffer(); }
    setLocalDescription(desc) { this.localDescription = desc; return Promise.resolve(); }
    setRemoteDescription(desc) { this.remoteDescription = desc; return Promise.resolve(); }
    getStats() { return Promise.resolve(new Map()); }
    close() {}
  }
  Object.defineProperty(window, 'RTCPeerConnection', { get: () => FakeRTCPeerConnection });
  Object.defineProperty(window, 'webkitRTCPeerConnection', { get: () => FakeRTCPeerConnection });
  Object.defineProperty(window, 'RTCIceGatherer', { get: () => undefined });

  // --- Iframes spoof ---
  const observer = new MutationObserver(() => {
    document.querySelectorAll("iframe").forEach(frame => {
      try {
        const w = frame.contentWindow;
        if (w) {
          Object.defineProperty(w, 'RTCPeerConnection', { get: () => FakeRTCPeerConnection });
          Object.defineProperty(w, 'webkitRTCPeerConnection', { get: () => FakeRTCPeerConnection });
          Object.defineProperty(w, 'RTCIceGatherer', { get: () => undefined });
        }
      } catch (_) {}
    });
  });
  observer.observe(document, { childList: true, subtree: true });

  // --- Screen spoof ---
  Object.defineProperties(window.screen, {
    width: { get: () => 1920, configurable: true },
    height: { get: () => 1080, configurable: true },
    availWidth: { get: () => 1920, configurable: true },
    availHeight: { get: () => 1040, configurable: true }
  });

  // --- HARD patch for Intl in Web Worker context ---
  if (typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope) {
    hardSpoofIntl();
    Object.defineProperty(self.navigator, 'language', { get: () => locale });
    Object.defineProperty(self.navigator, 'languages', { get: () => [locale, locale.split('-')[0]] });
  }

  log("✅ spoof.js fully loaded |", locale, timezone);
})();
