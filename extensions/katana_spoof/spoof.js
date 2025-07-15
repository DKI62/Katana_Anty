(() => {
  const safeSDP = "v=0\r\no=- 0 0 IN IP4 0.0.0.0\r\ns=-\r\nc=IN IP4 0.0.0.0\r\nt=0 0\r\n";

  // 💡 WebRTC защита: полностью мокаем RTCPeerConnection и SDP
  class FakeRTCPeerConnection {
    constructor() {
      this.localDescription = null;
      this.remoteDescription = null;
      this.iceGatheringState = "complete";
      this.connectionState = "connected";
      this.signalingState = "stable";
      this.iceConnectionState = "connected";
    }
    createDataChannel() { return {}; }
    addIceCandidate() { return Promise.resolve(); }
    createOffer() { return Promise.resolve({ type: "offer", sdp: safeSDP }); }
    createAnswer() { return Promise.resolve({ type: "answer", sdp: safeSDP }); }
    setLocalDescription(desc) { this.localDescription = desc; return Promise.resolve(); }
    setRemoteDescription(desc) { this.remoteDescription = desc; return Promise.resolve(); }
    getStats() { return Promise.resolve(new Map()); }
    close() {}
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() { return false; }
  }

  const blockWebRTC = (target = window) => {
    Object.defineProperty(target, "RTCPeerConnection", {
      get: () => FakeRTCPeerConnection,
      configurable: true
    });
    Object.defineProperty(target, "webkitRTCPeerConnection", {
      get: () => FakeRTCPeerConnection,
      configurable: true
    });
    Object.defineProperty(target, "RTCIceGatherer", {
      get: () => undefined,
      configurable: true
    });
  };

  blockWebRTC(window);

  // iframe защита
  const observeFrames = () => {
    const protect = () => {
      for (const frame of document.querySelectorAll("iframe")) {
        try {
          if (!frame.contentWindow) continue;
          blockWebRTC(frame.contentWindow);
        } catch (_) {}
      }
    };
    const observer = new MutationObserver(protect);
    observer.observe(document, { childList: true, subtree: true });
    protect();
  };

  // 🌐 WebGL spoof
  const spoofed = [
    { vendor: "NVIDIA Corporation", renderer: "NVIDIA GeForce RTX 3060" },
    { vendor: "Intel Inc.", renderer: "Intel Iris Xe Graphics" },
    { vendor: "Apple Inc.", renderer: "Apple M1" }
  ];
  const selected = spoofed[Math.floor(Math.random() * spoofed.length)];
  const getParam = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function (param) {
    if (param === 37445) return selected.vendor;
    if (param === 37446) return selected.renderer;
    return getParam.call(this, param);
  };

// 🕒 Timezone spoof – full patch with locale fix
(() => {
  const spoofedTimezones = [
    { name: "America/New_York", offset: 300 },
    { name: "America/Chicago", offset: 360 },
    { name: "America/Denver", offset: 420 },
    { name: "America/Los_Angeles", offset: 480 },
    { name: "America/Phoenix", offset: 420 }
  ];

  const selected = spoofedTimezones[Math.floor(Math.random() * spoofedTimezones.length)];
  const spoofOffsetMinutes = selected.offset; // minutes behind UTC
  const spoofOffsetMs = spoofOffsetMinutes * 60 * 1000;

  const RealDate = Date;
  const realNow = RealDate.now();
  const realOffset = new RealDate().getTimezoneOffset(); // in minutes

  // 🕒 Compute time delta
  const offsetDeltaMs = (realOffset - spoofOffsetMinutes) * 60 * 1000;

  // 💣 Full Date override
  function FakeDate(...args) {
    let dateInstance;
    if (args.length === 0) {
      dateInstance = new RealDate(realNow - offsetDeltaMs + (RealDate.now() - realNow));
    } else {
      dateInstance = new RealDate(...args);
    }

    // Patch methods
    const patch = {
      getTimezoneOffset: () => spoofOffsetMinutes,
      toString: () => new RealDate(dateInstance.getTime() + offsetDeltaMs).toString(),
      toTimeString: () => new RealDate(dateInstance.getTime() + offsetDeltaMs).toTimeString(),
      toLocaleString: (...a) => new RealDate(dateInstance.getTime() + offsetDeltaMs).toLocaleString(...a),
      toLocaleTimeString: (...a) => new RealDate(dateInstance.getTime() + offsetDeltaMs).toLocaleTimeString(...a),
      toLocaleDateString: (...a) => new RealDate(dateInstance.getTime() + offsetDeltaMs).toLocaleDateString(...a),
      toDateString: () => new RealDate(dateInstance.getTime() + offsetDeltaMs).toDateString(),
      toUTCString: () => new RealDate(dateInstance.getTime() + offsetDeltaMs).toUTCString()
    };

    Object.setPrototypeOf(patch, RealDate.prototype);
    Object.setPrototypeOf(dateInstance, patch);

    return dateInstance;
  }

  // 📌 Fix static methods
  FakeDate.now = () => RealDate.now() - offsetDeltaMs;
  FakeDate.UTC = RealDate.UTC;
  FakeDate.parse = RealDate.parse;
  FakeDate.prototype = RealDate.prototype;

  window.Date = FakeDate;

  // 🌐 Intl.DateTimeFormat timezone spoof
  const realResolved = Intl.DateTimeFormat.prototype.resolvedOptions;
  Intl.DateTimeFormat.prototype.resolvedOptions = function () {
    const opts = realResolved.apply(this, arguments);
    return { ...opts, timeZone: selected.name };
  };

  // 🌐 Intl spoof locale fix
  const OriginalDateTimeFormat = Intl.DateTimeFormat;
  Intl.DateTimeFormat = function (locale = "en-US", options) {
    return new OriginalDateTimeFormat("en-US", options);
  };
  Intl.DateTimeFormat.prototype = OriginalDateTimeFormat.prototype;

  console.log(`[🕒] Spoofed Timezone: ${selected.name}, Offset: ${spoofOffsetMinutes} min`);
})();
  // 👤 Navigator spoof
  Object.defineProperties(navigator, {
    userAgent: {
      get: () => "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
      configurable: true
    },
    platform: {
      get: () => "Win32",
      configurable: true
    },
    language: {
      get: () => "en-US",
      configurable: true
    },
    languages: {
      get: () => ["en-US", "en"],
      configurable: true
    }
  });

  // 🖥️ Screen spoof
  Object.defineProperties(window.screen, {
    width: { get: () => 1920, configurable: true },
    height: { get: () => 1080, configurable: true },
    availWidth: { get: () => 1920, configurable: true },
    availHeight: { get: () => 1040, configurable: true }
  });

  // 🧠 Iframe защита на старте
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", observeFrames);
  } else {
    observeFrames();
  }

  console.log("[+] Katana spoof.js loaded.");
})();
