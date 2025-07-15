(async function () {
  const src = chrome.runtime.getURL("spoof.js");
  const script = document.createElement("script");
  script.src = src;
  script.type = "text/javascript";
  script.onload = function () {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
})();
