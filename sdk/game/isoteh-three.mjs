// A billboard for Three.js games. Pass your own THREE (any recent version) so this file carries no copy of it.
//
//   const board = new AdBoard(THREE, { server, slot, width: 8, height: 4 });
//   scene.add(board.mesh);
//   function loop(dt) { board.update(camera, renderer, dt, { occluders: [city] }); ... }
//   // on tap: if (board.hit(raycaster)) board.open();
//
// The board shows the ad with a small "Sponsored" strip, an "Advertise here" card when the slot is free, or a plain
// panel. It measures what the player sees itself (see GameAd in isoteh-game.mjs for the rules).
import { GameAd } from './isoteh-game.mjs';

const GRID = 4;   // 4 x 4 sample points across the board for on-screen and hidden checks

export class AdBoard {
  constructor(THREE, { server, slot, width = 4, height = 2, keywords = '', px = 512, fetchFn }) {
    this.THREE = THREE; this.width = width; this.height = height;
    this.ad = new GameAd({ server, slot, keywords, ...(fetchFn ? { fetchFn } : {}) });
    this.canvas = document.createElement('canvas');
    this.canvas.width = px; this.canvas.height = Math.round(px * height / width);
    this.texture = new THREE.CanvasTexture(this.canvas);
    if ('colorSpace' in this.texture) this.texture.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false }));
    this.mesh.userData.adBoard = this;
    this.ray = new THREE.Raycaster();
    this.frameNo = 0; this.hidden = 0; this.state = { visible: 0, share: 0, angle: 90 };
    this.paint(null);
    this.ready = this.reload();
  }

  async reload() {
    const got = await this.ad.load();
    if (got && got.image) {
      const img = new Image(); img.crossOrigin = 'anonymous'; img.src = got.image;
      try { await img.decode(); this.paint({ img, sponsor: got.sponsor, label: this.ad.data.label }); } catch { this.paint(null); }
    } else this.paint(got?.open ? { open: got.open } : null);
  }

  paint(c) {
    const g = this.canvas.getContext('2d'), W = this.canvas.width, H = this.canvas.height;
    g.fillStyle = '#1d1b19'; g.fillRect(0, 0, W, H);
    if (c?.img) {
      const s = Math.max(W / c.img.width, H / c.img.height), w = c.img.width * s, h = c.img.height * s;
      g.drawImage(c.img, (W - w) / 2, (H - h) / 2, w, h);
      const fs = Math.max(12, Math.round(H * 0.06));
      g.font = `600 ${fs}px system-ui, sans-serif`;
      const text = `${c.label} · ${c.sponsor}`, tw = g.measureText(text).width;
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, H - fs * 1.6, tw + fs, fs * 1.6);
      g.fillStyle = '#fff'; g.fillText(text, fs / 2, H - fs * 0.5);
    } else {
      g.fillStyle = '#f2ece4'; g.textAlign = 'center';
      g.font = `700 ${Math.round(H * 0.16)}px system-ui, sans-serif`;
      g.fillText(c?.open ? c.open.text : '', W / 2, H * 0.5);
      if (c?.open) { g.font = `${Math.round(H * 0.08)}px system-ui, sans-serif`; g.fillText(`from ${c.open.from}`, W / 2, H * 0.68); }
    }
    this.texture.needsUpdate = true;
  }

  /** Measure what the camera sees and count a view when the rules are met. Call once a frame. */
  update(camera, renderer, dt, { occluders = [] } = {}) {
    const T = this.THREE, m = this.mesh;
    this.frameNo++;
    m.updateWorldMatrix(true, false);
    const pts = [], corners = [];
    for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
      pts.push(new T.Vector3(((i + 0.5) / GRID - 0.5) * this.width, ((j + 0.5) / GRID - 0.5) * this.height, 0).applyMatrix4(m.matrixWorld));
    }
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) corners.push(new T.Vector3(x * this.width / 2, y * this.height / 2, 0).applyMatrix4(m.matrixWorld).project(camera));
    // on screen: sample points inside the view
    const camPos = camera.getWorldPosition(new T.Vector3());
    let inside = 0, open = 0;
    const check = this.frameNo % 4 === 0 && occluders.length;   // hidden checks every 4th frame, to stay cheap on phones
    for (const p of pts) {
      const s = p.clone().project(camera);
      if (Math.abs(s.x) > 1 || Math.abs(s.y) > 1 || s.z > 1 || s.z < -1) continue;
      inside++;
      if (check) {
        const dir = p.clone().sub(camPos), dist = dir.length();
        this.ray.set(camPos, dir.normalize()); this.ray.far = dist - 0.01;
        if (!this.ray.intersectObjects(occluders, true).length) open++;
      }
    }
    if (check) this.hidden = inside ? 1 - open / inside : 0;
    const visible = (inside / pts.length) * (1 - this.hidden);
    // share of the screen: the board's outline on screen (shoelace), times how much of it shows
    let area = 0;
    for (let i = 0; i < 4; i++) { const a = corners[i], b = corners[(i + 1) % 4]; area += a.x * b.y - b.x * a.y; }
    const share = Math.min(1, Math.abs(area) / 2 / 4) * visible;
    // angle between the board's face and the line to the camera
    const normal = new T.Vector3(0, 0, 1).transformDirection(m.matrixWorld);
    const toCam = camPos.clone().sub(m.getWorldPosition(new T.Vector3())).normalize();
    const angle = Math.acos(Math.min(1, Math.abs(normal.dot(toCam)))) * 180 / Math.PI;
    this.state = { visible, share, angle };
    return this.ad.frame(dt, this.state);
  }

  /** True when a raycaster (from a tap or the crosshair) hits the board. */
  hit(raycaster) { return raycaster.intersectObject(this.mesh, false).length > 0; }
  open() { return this.ad.open(); }
  get counted() { return this.ad.counted; }
  dispose() { this.texture.dispose(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
