/**
 * Generic scene-graph hotspot viewer.
 * Reusable across projects: drop viewer.js + viewer.css into any project,
 * point <div id="viewer-root" data-config="..."> at a config.json shaped like:
 *
 * {
 *   "start": "sceneId",
 *   "scenes": {
 *     "sceneId": {
 *       "media": { "type": "video" | "image", "src": "path" },  // video loops, muted, autoplay
 *       "hotspots": [
 *         { "id", "label", "x", "y" (percent of stage),
 *           "transition": "path/to/clip.mp4",  // plays once
 *           "target": "otherSceneId" }
 *       ],
 *       "back": { "transition": "path/to/clip.mp4", "target": "otherSceneId", "label": "optional text" },
 *       "nav": {
 *         "left": { "target": "otherSceneId", "transition": "optional/path.mp4" },
 *         "right": { "target": "otherSceneId", "transition": "optional/path.mp4" }
 *       },
 *       "dayNightTransition": "path/to/day-to-night-clip.mp4",
 *       "dayNightImage": "path/to/night-still.png",
 *       "markers": [
 *         { "id", "label", "icon": "beach|school|basketball|walking|park|restaurant|project|shopping|pool|lobby|spa|gym|wellness|apartment|seaview",
 *           "x", "y", "video": "optional/path.mp4" }
 *         // OR, instead of "video", a "gallery" for a multi-room walkthrough:
 *         // "gallery": { "title", "description", "rooms": [ { "id", "label", "video" } ] }
 *       ]
 *     }
 *   },
 *   "aspectRatio": "16/9"  // optional, defaults to 16/9 — the intrinsic aspect ratio of the media
 * }
 *
 * Every scene has a looping background (image or video) and any number of
 * hotspots, each of which plays a one-shot transition clip before landing on
 * another scene. A scene's optional "back" entry renders a back button that
 * does the same thing in reverse. A scene's optional "nav" entry renders
 * left/right arrow buttons centered on the frame for stepping to sibling
 * scenes (e.g. rotating between camera angles); nav switches are instant
 * unless a "transition" clip is given. A scene's optional
 * "dayNightTransition" renders a moon/sun toggle in the top-right corner:
 * clicking it while showing "day" plays that clip once, then settles on
 * "night" — a still image if the scene gives "dayNightImage", otherwise the
 * transition clip's own last frame. Clicking again cuts instantly back to
 * the scene's own looping day background. Add new places to visit purely by
 * editing config.json — no code changes needed.
 *
 * A scene's optional "markers" are amenity pins (icon + hover label). A
 * marker with a "video" plays that clip once as a full-frame overlay (with
 * a close (X) button in the top-right corner to skip it early) and then
 * returns to the same scene. A marker with a "gallery" instead opens a
 * multi-room walkthrough: a looping video for the selected room, a
 * thumbnail filmstrip with prev/next arrows to switch rooms, and a
 * collapsible title/description note card in the top-left corner. A marker
 * with neither is a plain informational pin with no click action.
 *
 * Hotspot/marker x/y are percentages of the media's own rendered frame, not
 * the raw window — the frame is letterboxed/pillarboxed to aspectRatio and
 * kept centered at any window size, so a pin stays put on the footage
 * regardless of viewport size.
 */

const MARKER_ICONS = {
  beach: `<path d="M12 3v18M4 21h16M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9z" />`,
  school: `<path d="M12 3 2 8l10 5 10-5-10-5z" /><path d="M6 10.5V16c0 1.5 2.5 3 6 3s6-1.5 6-3v-5.5" />`,
  basketball: `<circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3v18M5.6 5.6c3 3 3 9.8 0 12.8M18.4 5.6c-3 3-3 9.8 0 12.8" />`,
  walking: `<path d="M5 20.5c8 0 2-6 8-8.3s-4-4 4-6.2" /><path d="M18 4.6a1.5 1.5 0 0 1 3 0" /><line x1="19.5" y1="4.6" x2="19.5" y2="7.4" /><path d="M6 9.4a1.5 1.5 0 0 1 3 0" /><line x1="7.5" y1="9.4" x2="7.5" y2="12.2" /><path d="M12.5 15.4a1.5 1.5 0 0 1 3 0" /><line x1="14" y1="15.4" x2="14" y2="18.2" />`,
  park: `<path d="M12 3 7 11h3l-3.5 6H10v4h4v-4h3.5L14 11h3z" />`,
  restaurant: `<path d="M7 2v7a2 2 0 0 0 4 0V2M9 2v20M17 2c-1.7 0-3 2-3 4.5S15.3 11 17 11v11" />`,
  project: `<g fill="currentColor" stroke="none"><rect x="6" y="9" width="3" height="12" /><rect x="10.5" y="3" width="3" height="18" /><rect x="15" y="12" width="3" height="9" /></g>`,
  shopping: `<path d="M6 8h12l-1 12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" />`,
  pool: `<rect x="3" y="6" width="18" height="13" rx="2" /><path d="M5 12.5c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0" />`,
  lobby: `<rect x="7" y="3" width="10" height="18" rx="1" /><circle cx="14" cy="12" r="0.9" fill="currentColor" stroke="none" />`,
  spa: `<path d="M12 3c4 4.5 6 8.5 4 12.5a4 4 0 0 1-8 0c-2-4 0-8 4-12.5z" />`,
  gym: `<line x1="6.5" y1="12" x2="17.5" y2="12" /><rect x="2.5" y="9" width="3" height="6" rx="1" /><rect x="18.5" y="9" width="3" height="6" rx="1" />`,
  wellness: `<path d="M12 20s-7-4.4-9-8.8A4.6 4.6 0 0 1 12 7.8a4.6 4.6 0 0 1 9 3.4c-2 4.4-9 8.8-9 8.8z" />`,
  apartment: `<rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="M5 15.5l3.5-3.5 2.5 2.5 4.5-5 3.5 3.5" />`,
  seaview: `<rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="M5 12.5c1.7-1.3 3.3-1.3 5 0s3.3 1.3 5 0 3.3-1.3 5 0" /><path d="M5 16.2c1.7-1.3 3.3-1.3 5 0s3.3 1.3 5 0 3.3-1.3 5 0" />`,
};

class HotspotViewer {
  constructor(root, configUrl) {
    this.root = root;
    this.configUrl = configUrl;
    this.currentSceneId = null;
    this.pendingTarget = null;
    this.aspectRatio = 16 / 9;
    this.isNight = false;
    this.isPreview = false;
    this.galleryRooms = null;
    this.galleryIndex = 0;
    this.galleryActiveIndex = 0;
    this.galleryCleanupTimer = null;
    this.prefetchedUrls = new Set();
    this.prefetchDelayTimer = null;
  }

  async init() {
    const res = await fetch(this.configUrl);
    this.config = await res.json();
    if (this.config.aspectRatio) {
      const [w, h] = String(this.config.aspectRatio).split("/").map(Number);
      if (w && h) this.aspectRatio = w / h;
    }
    this.render();
    window.setTimeout(() => this.prefetchAllScenes(), 6000);
  }

  render() {
    this.root.innerHTML = `
      <div class="hv-stage" data-mode="scene">
        <div class="hv-frame">
          <video class="hv-bg-video" autoplay loop muted playsinline></video>
          <img class="hv-bg-image" alt="">
          <video class="hv-daynight-video" playsinline></video>
          <img class="hv-daynight-image" alt="">
          <div class="hv-hotspot-layer"></div>
          <div class="hv-marker-layer"></div>
          <div class="hv-nav-layer"></div>
          <video class="hv-transition-video" playsinline></video>
          <video class="hv-gallery-video" muted playsinline></video>
          <video class="hv-gallery-video" muted playsinline></video>
          <div class="hv-gallery-note">
            <div class="hv-gallery-note-body">
              <div class="hv-gallery-note-title"></div>
              <div class="hv-gallery-note-desc"></div>
            </div>
            <button type="button" class="hv-gallery-note-toggle" aria-label="Collapse note">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 6 9 12 15 18" />
              </svg>
            </button>
          </div>
          <div class="hv-gallery-filmstrip">
            <button type="button" class="hv-gallery-nav hv-gallery-prev" aria-label="Previous room">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 6 9 12 15 18" />
              </svg>
            </button>
            <div class="hv-gallery-thumbs"></div>
            <button type="button" class="hv-gallery-nav hv-gallery-next" aria-label="Next room">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 6 15 12 9 18" />
              </svg>
            </button>
            <button type="button" class="hv-gallery-filmstrip-toggle" aria-label="Hide room list">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
        </div>
        <button type="button" class="hv-back-btn" hidden></button>
        <button type="button" class="hv-daynight-btn" hidden></button>
        <button type="button" class="hv-close-btn" hidden aria-label="Close">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <line x1="5" y1="5" x2="19" y2="19" />
            <line x1="19" y1="5" x2="5" y2="19" />
          </svg>
        </button>
      </div>
    `;

    this.stageEl = this.root.querySelector(".hv-stage");
    this.frameEl = this.root.querySelector(".hv-frame");
    this.bgVideoEl = this.root.querySelector(".hv-bg-video");
    this.bgImageEl = this.root.querySelector(".hv-bg-image");
    this.daynightVideoEl = this.root.querySelector(".hv-daynight-video");
    this.daynightImageEl = this.root.querySelector(".hv-daynight-image");
    this.hotspotLayer = this.root.querySelector(".hv-hotspot-layer");
    this.markerLayer = this.root.querySelector(".hv-marker-layer");
    this.navLayer = this.root.querySelector(".hv-nav-layer");
    this.transitionVideoEl = this.root.querySelector(".hv-transition-video");
    this.backBtn = this.root.querySelector(".hv-back-btn");
    this.daynightBtn = this.root.querySelector(".hv-daynight-btn");
    this.closeBtn = this.root.querySelector(".hv-close-btn");
    this.galleryVideoEls = Array.from(this.root.querySelectorAll(".hv-gallery-video"));
    this.galleryNoteEl = this.root.querySelector(".hv-gallery-note");
    this.galleryNoteTitleEl = this.root.querySelector(".hv-gallery-note-title");
    this.galleryNoteDescEl = this.root.querySelector(".hv-gallery-note-desc");
    this.galleryNoteToggleBtn = this.root.querySelector(".hv-gallery-note-toggle");
    this.galleryThumbsEl = this.root.querySelector(".hv-gallery-thumbs");
    this.galleryPrevBtn = this.root.querySelector(".hv-gallery-prev");
    this.galleryNextBtn = this.root.querySelector(".hv-gallery-next");
    this.galleryFilmstripEl = this.root.querySelector(".hv-gallery-filmstrip");
    this.galleryFilmstripToggleBtn = this.root.querySelector(".hv-gallery-filmstrip-toggle");

    this.transitionVideoEl.addEventListener("ended", () => this.onTransitionEnded());
    this.daynightVideoEl.addEventListener("ended", () => this.onDayNightEnded());
    this.galleryVideoEls.forEach((el, i) => {
      el.addEventListener("ended", () => {
        if (this.galleryActiveIndex === i) this.selectGalleryRoom(this.galleryIndex + 1);
      });
    });
    this.backBtn.addEventListener("click", () => this.goBack());
    this.daynightBtn.addEventListener("click", () => this.toggleDayNight());
    this.closeBtn.addEventListener("click", () => {
      if (this.stageEl.dataset.mode === "gallery") this.closeGallery();
      else this.onTransitionEnded();
    });
    this.galleryNoteToggleBtn.addEventListener("click", () => {
      const collapsed = this.galleryNoteEl.classList.toggle("collapsed");
      this.galleryNoteToggleBtn.setAttribute("aria-label", collapsed ? "Expand note" : "Collapse note");
    });
    this.galleryFilmstripToggleBtn.addEventListener("click", () => {
      const collapsed = this.galleryFilmstripEl.classList.toggle("collapsed");
      this.galleryFilmstripToggleBtn.setAttribute("aria-label", collapsed ? "Show room list" : "Hide room list");
    });
    this.galleryPrevBtn.addEventListener("click", () => this.selectGalleryRoom(this.galleryIndex - 1));
    this.galleryNextBtn.addEventListener("click", () => this.selectGalleryRoom(this.galleryIndex + 1));

    this.resizeObserver = new ResizeObserver(() => this.updateFrameSize());
    this.resizeObserver.observe(this.stageEl);
    this.updateFrameSize();

    this.goToScene(this.config.start);
  }

  updateFrameSize() {
    const stageW = this.stageEl.clientWidth;
    const stageH = this.stageEl.clientHeight;
    if (!stageW || !stageH) return;
    let w = stageW;
    let h = w / this.aspectRatio;
    if (h > stageH) {
      h = stageH;
      w = h * this.aspectRatio;
    }
    this.frameEl.style.width = `${w}px`;
    this.frameEl.style.height = `${h}px`;
  }

  goToScene(sceneId) {
    const scene = this.config.scenes[sceneId];
    if (!scene) return;
    this.currentSceneId = sceneId;
    this.stageEl.dataset.mode = "scene";
    this.isPreview = false;
    this.closeBtn.hidden = true;
    clearTimeout(this.galleryCleanupTimer);
    this.galleryVideoEls.forEach((el) => {
      el.pause();
      el.removeAttribute("src");
      el.classList.remove("hv-gallery-video--visible");
    });
    this.galleryRooms = null;

    if (scene.media.type === "video") {
      this.bgImageEl.removeAttribute("src");
      this.bgVideoEl.src = scene.media.src;
      this.bgVideoEl.currentTime = 0;
      this.bgVideoEl.play().catch(() => {});
    } else {
      this.bgVideoEl.pause();
      this.bgVideoEl.removeAttribute("src");
      this.bgImageEl.src = scene.media.src;
    }

    this.hotspotLayer.innerHTML = "";
    (scene.hotspots || []).forEach((hotspot) => this.addHotspot(hotspot));

    this.markerLayer.innerHTML = "";
    (scene.markers || []).forEach((marker) => this.addMarker(marker));

    this.navLayer.innerHTML = "";
    if (scene.nav && scene.nav.left) this.addNavButton("left", scene.nav.left);
    if (scene.nav && scene.nav.right) this.addNavButton("right", scene.nav.right);

    if (scene.back) {
      this.backBtn.hidden = false;
      this.backBtn.textContent = scene.back.label || "← Back";
    } else {
      this.backBtn.hidden = true;
    }

    this.isNight = false;
    // Switching scenes should snap out of night mode instantly — the 0.5s
    // opacity fade in CSS is only meant for the deliberate day/night toggle
    // click, not a scene change. Without this, the previous scene's frozen
    // night frame visibly fades out on top of the new scene's day video.
    this.daynightVideoEl.style.transition = "none";
    this.stageEl.dataset.daynight = "";
    this.daynightVideoEl.pause();
    this.daynightVideoEl.removeAttribute("src");
    this.daynightImageEl.removeAttribute("src");
    void this.daynightVideoEl.offsetHeight;
    this.daynightVideoEl.style.transition = "";
    if (scene.dayNightTransition) {
      this.daynightBtn.hidden = false;
      this.updateDayNightIcon();
    } else {
      this.daynightBtn.hidden = true;
    }

    clearTimeout(this.prefetchDelayTimer);
    this.prefetchDelayTimer = window.setTimeout(() => this.prefetchReachable(scene), 1200);
  }

  // Warms the browser's cache for this scene's video clips so playback
  // starts instantly instead of buffering over the network, without trying
  // to preload every clip in the whole site up front (571MB total — that
  // would make the very first page load much slower, trading one delay for
  // a worse one).
  //
  // Two tiers, ordered by how likely/soon a click is:
  //   - primary: hotspot/nav/back transitions and the background video of
  //     whatever scene each leads to. Fetched first, all at once.
  //   - secondary: amenity marker videos, gallery room videos, and the
  //     day/night transition. Fetched afterward, staggered one at a time so
  //     they don't compete with the primary tier or each other for
  //     bandwidth. There can be a dozen of these per scene, so most of the
  //     benefit here is warming the connection/DNS/TLS rather than fully
  //     buffering every one before a click.
  prefetchReachable(scene) {
    this.root.querySelectorAll(".hv-prefetch").forEach((el) => el.remove());

    const primaryUrls = [];
    const secondaryUrls = [];
    const addTarget = (targetId, bucket) => {
      const target = this.config.scenes[targetId];
      if (target && target.media.type === "video") bucket.push(target.media.src);
    };
    (scene.hotspots || []).forEach((h) => {
      if (h.transition) primaryUrls.push(h.transition);
      if (h.target) addTarget(h.target, primaryUrls);
    });
    if (scene.nav) {
      ["left", "right"].forEach((dir) => {
        const n = scene.nav[dir];
        if (!n) return;
        if (n.transition) primaryUrls.push(n.transition);
        if (n.target) addTarget(n.target, primaryUrls);
      });
    }
    if (scene.back) {
      if (scene.back.transition) primaryUrls.push(scene.back.transition);
      if (scene.back.target) addTarget(scene.back.target, primaryUrls);
    }
    if (scene.dayNightTransition) secondaryUrls.push(scene.dayNightTransition);
    (scene.markers || []).forEach((m) => {
      if (m.video) secondaryUrls.push(m.video);
      if (m.gallery) (m.gallery.rooms || []).forEach((r) => { if (r.video) secondaryUrls.push(r.video); });
    });

    primaryUrls.forEach((url) => this.prefetchVideo(url));
    secondaryUrls.forEach((url, i) => {
      window.setTimeout(() => this.prefetchVideo(url), 2500 + i * 900);
    });
  }

  // Third tier, site-wide: every video clip referenced anywhere in
  // config.json, not just ones reachable from the current scene. Runs once,
  // well after the current scene's own prefetchReachable() tiers have had a
  // head start, and is heavily staggered since there can be 40+ clips —
  // dedup against this.prefetchedUrls means anything already warmed by
  // prefetchReachable() is skipped automatically.
  prefetchAllScenes() {
    const urls = [];
    Object.values(this.config.scenes).forEach((scene) => {
      if (scene.media && scene.media.type === "video") urls.push(scene.media.src);
      (scene.hotspots || []).forEach((h) => { if (h.transition) urls.push(h.transition); });
      if (scene.nav) {
        ["left", "right"].forEach((dir) => {
          const n = scene.nav[dir];
          if (n && n.transition) urls.push(n.transition);
        });
      }
      if (scene.back && scene.back.transition) urls.push(scene.back.transition);
      if (scene.dayNightTransition) urls.push(scene.dayNightTransition);
      (scene.markers || []).forEach((m) => {
        if (m.video) urls.push(m.video);
        if (m.gallery) (m.gallery.rooms || []).forEach((r) => { if (r.video) urls.push(r.video); });
      });
    });

    const seen = new Set();
    const uniqueUrls = urls.filter((url) => {
      if (seen.has(url) || this.prefetchedUrls.has(url)) return false;
      seen.add(url);
      return true;
    });
    uniqueUrls.forEach((url, i) => {
      window.setTimeout(() => this.prefetchVideo(url), i * 700);
    });
  }

  prefetchVideo(url) {
    if (!url || this.prefetchedUrls.has(url)) return;
    this.prefetchedUrls.add(url);
    const video = document.createElement("video");
    video.className = "hv-prefetch";
    video.muted = true;
    video.preload = "auto";
    const cleanup = () => video.remove();
    video.addEventListener("canplaythrough", cleanup, { once: true });
    video.addEventListener("error", cleanup, { once: true });
    window.setTimeout(cleanup, 60000);
    video.src = url;
    video.load();
    this.root.appendChild(video);
  }

  addHotspot(hotspot) {
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "hv-hotspot";
    marker.style.left = `${hotspot.x}%`;
    marker.style.top = `${hotspot.y}%`;
    marker.setAttribute("aria-label", hotspot.label);
    marker.innerHTML = `
      <span class="hv-hotspot-pulse"></span>
      <span class="hv-hotspot-dot">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <rect x="6" y="9" width="3" height="12" />
          <rect x="10.5" y="3" width="3" height="18" />
          <rect x="15" y="12" width="3" height="9" />
        </svg>
      </span>
      <span class="hv-hotspot-tooltip">${hotspot.label}</span>
    `;
    marker.addEventListener("click", () => this.playTransition(hotspot.transition, hotspot.target));
    this.hotspotLayer.appendChild(marker);
  }

  addMarker(markerData) {
    const pin = document.createElement("button");
    pin.type = "button";
    pin.className = "hv-marker";
    if (markerData.video || markerData.gallery) pin.classList.add("hv-marker--playable");
    pin.style.left = `${markerData.x}%`;
    pin.style.top = `${markerData.y}%`;
    pin.setAttribute("aria-label", markerData.label);
    const iconPath = MARKER_ICONS[markerData.icon] || MARKER_ICONS.park;
    pin.innerHTML = `
      <span class="hv-marker-dot">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          ${iconPath}
        </svg>
      </span>
      <span class="hv-marker-tooltip">${markerData.label}</span>
    `;
    if (markerData.gallery) {
      pin.addEventListener("click", () => this.openGallery(markerData.gallery));
    } else if (markerData.video) {
      const sceneId = this.currentSceneId;
      pin.addEventListener("click", () => this.playTransition(markerData.video, sceneId, true));
    }
    this.markerLayer.appendChild(pin);
  }

  addNavButton(direction, nav) {
    const isLeft = direction === "left";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `hv-nav-btn hv-nav-${direction}`;
    btn.setAttribute("aria-label", isLeft ? "Previous view" : "Next view");
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="${isLeft ? "15 6 9 12 15 18" : "9 6 15 12 9 18"}" />
      </svg>
    `;
    btn.addEventListener("click", () => {
      if (nav.transition) {
        this.playTransition(nav.transition, nav.target);
      } else {
        this.goToScene(nav.target);
      }
    });
    this.navLayer.appendChild(btn);
  }

  toggleDayNight() {
    const scene = this.config.scenes[this.currentSceneId];
    if (!scene || !scene.dayNightTransition) return;

    if (!this.isNight) {
      this.stageEl.dataset.daynight = "playing";
      this.daynightVideoEl.src = scene.dayNightTransition;
      this.daynightVideoEl.currentTime = 0;
      this.daynightVideoEl.play().catch(() => {});
    } else {
      this.stageEl.dataset.daynight = "";
      this.daynightVideoEl.pause();
      this.daynightVideoEl.removeAttribute("src");
      this.daynightImageEl.removeAttribute("src");
      this.isNight = false;
      this.updateDayNightIcon();
    }
  }

  onDayNightEnded() {
    const scene = this.config.scenes[this.currentSceneId];
    this.isNight = true;
    if (scene.dayNightImage) {
      this.daynightVideoEl.pause();
      this.daynightVideoEl.removeAttribute("src");
      this.daynightImageEl.src = scene.dayNightImage;
    }
    this.stageEl.dataset.daynight = "night";
    this.updateDayNightIcon();
  }

  updateDayNightIcon() {
    this.daynightBtn.setAttribute("aria-label", this.isNight ? "Switch to day" : "Switch to night");
    this.daynightBtn.innerHTML = this.isNight
      ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="22" />
          <line x1="4" y1="12" x2="2" y2="12" />
          <line x1="22" y1="12" x2="20" y2="12" />
          <line x1="5" y1="5" x2="3.6" y2="3.6" />
          <line x1="20.4" y1="20.4" x2="19" y2="19" />
          <line x1="19" y1="5" x2="20.4" y2="3.6" />
          <line x1="3.6" y1="20.4" x2="5" y2="19" />
        </svg>`
      : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
        </svg>`;
  }

  goBack() {
    const scene = this.config.scenes[this.currentSceneId];
    if (!scene || !scene.back) return;
    this.playTransition(scene.back.transition, scene.back.target);
  }

  playTransition(src, targetSceneId, isPreview = false) {
    this.pendingTarget = targetSceneId;
    this.isPreview = isPreview;
    this.stageEl.dataset.mode = "transition";
    this.closeBtn.hidden = !isPreview;
    this.transitionVideoEl.src = src;
    this.transitionVideoEl.currentTime = 0;
    this.transitionVideoEl.play().catch(() => {});
  }

  onTransitionEnded() {
    const target = this.pendingTarget;
    this.pendingTarget = null;
    this.closeBtn.hidden = true;
    this.transitionVideoEl.pause();
    this.transitionVideoEl.removeAttribute("src");
    this.goToScene(target);
  }

  openGallery(gallery) {
    this.galleryRooms = gallery.rooms;
    this.galleryIndex = 0;
    this.stageEl.dataset.mode = "gallery";
    this.closeBtn.hidden = false;
    this.galleryNoteEl.classList.remove("collapsed");
    this.galleryNoteToggleBtn.setAttribute("aria-label", "Collapse note");
    this.galleryFilmstripEl.classList.remove("collapsed");
    this.galleryFilmstripToggleBtn.setAttribute("aria-label", "Hide room list");
    this.galleryNoteTitleEl.textContent = gallery.title || "";
    this.galleryNoteDescEl.textContent = gallery.description || "";

    this.galleryThumbsEl.innerHTML = "";
    this.galleryRooms.forEach((room, index) => {
      const thumb = document.createElement("button");
      thumb.type = "button";
      thumb.className = "hv-gallery-thumb";
      thumb.setAttribute("aria-label", room.label);
      thumb.innerHTML = `
        <video muted preload="metadata" playsinline src="${room.video}#t=0.5"></video>
        <span class="hv-gallery-thumb-label">${room.label}</span>
      `;
      thumb.addEventListener("click", () => this.selectGalleryRoom(index));
      this.galleryThumbsEl.appendChild(thumb);
    });

    this.selectGalleryRoom(0);
  }

  selectGalleryRoom(index) {
    if (!this.galleryRooms || !this.galleryRooms.length) return;
    this.galleryIndex = (index + this.galleryRooms.length) % this.galleryRooms.length;
    const room = this.galleryRooms[this.galleryIndex];

    Array.from(this.galleryThumbsEl.children).forEach((thumb, i) => {
      thumb.classList.toggle("active", i === this.galleryIndex);
    });
    const activeThumb = this.galleryThumbsEl.children[this.galleryIndex];
    if (activeThumb) activeThumb.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });

    // Cross-dissolve: bring in the other <video> element under the new clip
    // while the current one fades out, so both play briefly, overlapping.
    const outgoingEl = this.galleryVideoEls[this.galleryActiveIndex];
    const incomingEl = this.galleryVideoEls[1 - this.galleryActiveIndex];
    this.galleryActiveIndex = 1 - this.galleryActiveIndex;

    incomingEl.src = room.video;
    incomingEl.currentTime = 0;
    incomingEl.play().catch(() => {});
    incomingEl.classList.add("hv-gallery-video--visible");
    outgoingEl.classList.remove("hv-gallery-video--visible");

    clearTimeout(this.galleryCleanupTimer);
    this.galleryCleanupTimer = window.setTimeout(() => {
      outgoingEl.pause();
      outgoingEl.removeAttribute("src");
    }, 500);
  }

  closeGallery() {
    clearTimeout(this.galleryCleanupTimer);
    this.galleryVideoEls.forEach((el) => {
      el.pause();
      el.removeAttribute("src");
      el.classList.remove("hv-gallery-video--visible");
    });
    this.galleryRooms = null;
    this.closeBtn.hidden = true;
    this.stageEl.dataset.mode = "scene";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("viewer-root");
  if (!root) return;
  const configUrl = root.dataset.config || "config.json";
  new HotspotViewer(root, configUrl).init();
});
