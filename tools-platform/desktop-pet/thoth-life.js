/* Runtime use of the supplied six-frame artwork; no regenerated character frames. */
(function () {
  window.ThothLife = { create: function (ui) {
    var options = { randomMotionOn: true, proactiveStoriesOn: true, storyIntervalMinutes: 3 };
    var frames = [], catalog = [], deck = [], language = '', motionTimer = null, motionSource = '', chatBusy = false;
    var nextMotion = Date.now() + 12000, nextStory = Date.now() + 90000, loading = false;
    var strip = new Image();
    strip.onload = function () {
      var canvas = document.createElement('canvas');
      canvas.width = strip.naturalWidth / 6; canvas.height = strip.naturalHeight;
      var ctx = canvas.getContext('2d');
      for (var i = 0; i < 6; i++) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(strip, i * canvas.width, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL('image/png'));
      }
      if (ui.onFrontReady) ui.onFrontReady();
    };
    strip.src = './assets/thoth/blink-strip.png';
    function stop(restore) {
      if (motionTimer) clearTimeout(motionTimer);
      motionTimer = null;
      ui.img.classList.remove('thoth-observe', 'thoth-dream', 'thoth-greet');
      if (motionSource && restore !== false) ui.setSprite(motionSource);
      motionSource = '';
    }
    function busy() { return document.hidden || chatBusy || ui.busy(); }
    function motion(forced) {
      if (busy() || (!options.randomMotionOn && !forced)) return;
      stop(); motionSource = ui.img.getAttribute('src');
      var choice = Math.floor(Math.random() * 5);
      if (choice < 2 && frames.length === 6) {
        var order = choice === 0 ? [0, 1, 2, 3, 4, 5] : [0, 2, 3, 3, 2, 4, 5];
        var index = 0;
        function tick() {
          if (busy()) { stop(); return; }
          var frame = order[index++]; ui.setSprite(frames[frame],frame);
          if (index < order.length) motionTimer = setTimeout(tick, index === 4 ? 180 : 95);
          else motionTimer = setTimeout(stop, 120);
        }
        tick();
      } else {
        ui.setSprite(choice === 2 ? ui.images.think : choice === 3 ? ui.images.wave : frames[0] || ui.images.idle);
        ui.img.classList.add(choice === 2 ? 'thoth-dream' : choice === 3 ? 'thoth-greet' : 'thoth-observe');
        motionTimer = setTimeout(stop, 2400 + Math.random() * 2000);
      }
    }
    async function load() {
      var lang = window.PetI18n.getLanguage();
      if (!ui.ipc || loading || (catalog.length && language === lang)) return;
      loading = true;
      try {
        var result = await ui.ipc.invoke('pet-get-stories', lang);
        if (Array.isArray(result) && window.PetI18n.getLanguage() === lang) {
          catalog = result; language = lang; deck = [];
        }
      } catch (_) { /* Retry later if the local service is still starting. */ }
      finally { loading = false; }
    }
    function takeStory(id) {
      if (id) return catalog.find(function (s) { return s.id === id; });
      if (!deck.length) {
        deck = catalog.slice();
        for (var i = deck.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1)); var item = deck[i]; deck[i] = deck[j]; deck[j] = item;
        }
      }
      return deck.pop();
    }
    async function story(id, manual) {
      if (busy() || (!manual && (!options.proactiveStoriesOn || !ui.bubblesOn()))) return false;
      await load();
      if (busy() || language !== window.PetI18n.getLanguage()) return false;
      var item = takeStory(id);
      if (!item) return false;
      ui.showStory(item); return true;
    }
    function delayStory() { nextStory = Date.now() + options.storyIntervalMinutes * 60000 * (0.8 + Math.random() * 0.4); }
    function apply(config) {
      if (!config) return;
      if (typeof config.randomMotionOn === 'boolean') options.randomMotionOn = config.randomMotionOn;
      if (typeof config.proactiveStoriesOn === 'boolean') options.proactiveStoriesOn = config.proactiveStoriesOn;
      if (config.storyIntervalMinutes !== undefined) {
        options.storyIntervalMinutes = Math.max(1, Math.min(30, Number(config.storyIntervalMinutes) || 3)); delayStory();
      }
      if (!options.randomMotionOn) stop();
      if (!options.proactiveStoriesOn) ui.clearStory();
    }
    if (ui.ipc) ui.ipc.on('pet-chat-generating', function (_event, active) { chatBusy = !!active; if (active) stop(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); });
    window.addEventListener('pet:languagechange', function () { catalog = []; deck = []; ui.clearStory(); load(); });
    setInterval(function () {
      var now = Date.now();
      if (now >= nextMotion) { nextMotion = now + 10000 + Math.random() * 22000; motion(); }
      if (now >= nextStory && !busy()) {
        story(null, false).then(function (shown) { if (shown) delayStory(); else nextStory = Date.now() + 30000; });
      }
    }, 1000);
    load();
    return { frontSprite: function () { return frames[0]; }, stop: stop, apply: apply, motion: motion, story: story, options: options };
  } };
})();
