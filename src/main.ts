import "./style.css";
import {
  canDecode,
  cellFromIndex,
  makeStartingBoard,
  playableIndices,
  type Difficulty,
  type GameBoard,
} from "./game";

type Phase = "setup" | "playing" | "lost";

const app = document.querySelector<HTMLDivElement>("#app")!;
let board: GameBoard | null = null;
let phase: Phase = "setup";
let player = 0;
let loser = 0;
let turns = 0;
let difficulty: Difficulty = "normal";
let lastRemoved: number | null = null;
let resolving = false;

function render() {
  app.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <div class="brand"><span class="brand-mark" aria-hidden="true"></span><span>QRジェンガ</span></div>
        <button class="text-button" id="rulesButton" type="button">遊び方</button>
      </header>
      ${phase === "setup" ? setupView() : gameView()}
    </main>
    <dialog id="rulesDialog">
      <button class="dialog-close" id="closeRules" aria-label="閉じる">×</button>
      <p class="eyebrow">HOW TO PLAY</p>
      <h2>読めなくしたら、負け。</h2>
      <ol>
        <li>2人で交互に、黒いマスを1つ選びます。</li>
        <li>黒いマスをタップすると、その場で取り除かれます。</li>
        <li>即座にスキャンされ、読み取れなくしたプレイヤーの負けです。</li>
      </ol>
      <p class="dialog-note">角の大きな模様など、斜線のマスは安全のため抜けません。</p>
    </dialog>
  `;

  bindCommon();
  if (phase === "setup") bindSetup();
  else bindGame();
}

function setupView() {
  return `
    <section class="setup-card">
      <div class="intro">
        <p class="eyebrow">TWO PLAYER GAME</p>
        <h1>壊すのは、<br><em>あと何マス？</em></h1>
        <p class="lead">読めるQRコードから黒いマスを1つずつ抜く、逆ジェンガ。読み取りを止めた人が負け。</p>
      </div>
      <div class="setup-panel">
        <fieldset>
          <legend>難易度</legend>
          <div class="difficulty-grid">
            ${difficultyButton("easy", "ゆっくり", "猶予 8")}
            ${difficultyButton("normal", "ふつう", "猶予 5")}
            ${difficultyButton("hard", "ギリギリ", "猶予 2")}
          </div>
        </fieldset>
        <div class="player-preview" aria-label="プレイヤー順">
          <span><b>01</b> PLAYER 1</span><i>VS</i><span><b>02</b> PLAYER 2</span>
        </div>
        <button class="primary" id="startButton">ゲームをはじめる</button>
        <p class="calibration-note">開始時に、読み取れるギリギリの盤面をつくります。</p>
      </div>
    </section>
  `;
}

function difficultyButton(value: Difficulty, label: string, note: string) {
  return `<button type="button" class="difficulty ${difficulty === value ? "active" : ""}" data-difficulty="${value}"><strong>${label}</strong><small>${note}</small></button>`;
}

function gameView() {
  if (!board) return "";
  const current = player + 1;
  const status = phase === "lost"
    ? `<div class="result"><p class="eyebrow">SCAN FAILED</p><h1>PLAYER ${loser + 1} の負け</h1><p>${turns}手目でQRコードが読めなくなりました。</p></div>`
    : `<div class="turn"><span class="pulse" aria-hidden="true"></span><div><small>TURN ${turns + 1}</small><strong>PLAYER ${current}</strong></div></div>`;
  return `
    <section class="game-layout">
      <aside class="game-info">
        ${status}
        <div class="instruction">
          <span class="step">${phase === "lost" ? "END" : "01"}</span>
          <p>${phase === "lost" ? "勝負あり。完成時のメッセージを確認できます。" : "黒いマスをタップすると即破壊・即スキャン。斜線部分は保護されています。"}</p>
        </div>
        ${phase === "lost" ? `<div class="payload"><small>QRの中身</small><code>${board.payload}</code></div><button class="primary" id="restartButton">もう一度あそぶ</button>` : `<div class="instant-note"><span>INSTANT SCAN</span><strong>${turns}</strong><small>マス撃破</small></div>`}
        <button class="secondary" id="backButton">難易度を選び直す</button>
      </aside>
      <div class="board-wrap">
        <div class="scan-line" aria-hidden="true"></div>
        <div class="qr-board" role="grid" aria-label="QRコード盤面" style="--size:${board.size}">
          ${renderCells(board)}
        </div>
        <div class="board-meta"><span>ERROR CORRECTION H</span><span>${board.size} × ${board.size}</span></div>
      </div>
    </section>
  `;
}

function renderCells(value: GameBoard) {
  return value.cells.map((black, index) => {
    const removed = value.removed.has(index);
    const protectedCell = value.protectedCells[index];
    const playable = black && !removed && !protectedCell && phase === "playing";
    const classes = [black && !removed ? "black" : "white", removed ? "removed" : "", protectedCell && black ? "protected" : "", lastRemoved === index ? "fresh" : ""].filter(Boolean).join(" ");
    const cell = cellFromIndex(value, index);
    return `<button class="cell ${classes}" role="gridcell" data-index="${index}" ${playable ? "" : "disabled"} aria-label="${cell.x + 1}列 ${cell.y + 1}行${playable ? "、タップですぐ抜きます" : ""}"></button>`;
  }).join("");
}

function bindCommon() {
  const dialog = document.querySelector<HTMLDialogElement>("#rulesDialog")!;
  document.querySelector("#rulesButton")?.addEventListener("click", () => dialog.showModal());
  document.querySelector("#closeRules")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
}

function bindSetup() {
  document.querySelectorAll<HTMLButtonElement>("[data-difficulty]").forEach((button) => {
    button.addEventListener("click", () => {
      difficulty = button.dataset.difficulty as Difficulty;
      render();
    });
  });
  document.querySelector("#startButton")?.addEventListener("click", () => {
    const button = document.querySelector<HTMLButtonElement>("#startButton")!;
    button.disabled = true;
    button.textContent = "盤面を調整中…";
    window.setTimeout(() => {
      board = makeStartingBoard(difficulty);
      phase = "playing";
      player = 0;
      turns = 0;
      lastRemoved = null;
      render();
    }, 30);
  });
}

function bindGame() {
  document.querySelectorAll<HTMLButtonElement>(".cell:not(:disabled)").forEach((cell) => {
    cell.addEventListener("click", () => {
      if (!board || resolving) return;
      resolving = true;
      const index = Number(cell.dataset.index);
      const rect = cell.getBoundingClientRect();
      board.removed.add(index);
      lastRemoved = index;
      turns += 1;
      const readable = canDecode(board);
      if (!readable) {
        loser = player;
        phase = "lost";
      } else {
        player = player === 0 ? 1 : 0;
      }
      render();
      burst(rect.left + rect.width / 2, rect.top + rect.height / 2, !readable);
      navigator.vibrate?.(!readable ? [80, 45, 160] : 35);
      window.setTimeout(() => { resolving = false; }, 80);
    });
  });
  document.querySelector("#restartButton")?.addEventListener("click", () => {
    board = makeStartingBoard(difficulty);
    phase = "playing";
    player = 0;
    turns = 0;
    lastRemoved = null;
    render();
  });
  document.querySelector("#backButton")?.addEventListener("click", () => {
    phase = "setup";
    board = null;
    lastRemoved = null;
    render();
  });
}

function burst(x: number, y: number, isLoss: boolean) {
  const layer = document.createElement("div");
  layer.className = `fx-layer${isLoss ? " loss" : ""}`;
  layer.style.setProperty("--x", `${x}px`);
  layer.style.setProperty("--y", `${y}px`);
  const count = isLoss ? 32 : 12;
  layer.innerHTML = `<i class="shockwave"></i>${Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count + Math.random() * .35;
    const distance = (isLoss ? 95 : 48) + Math.random() * (isLoss ? 150 : 55);
    return `<i class="particle" style="--dx:${Math.cos(angle) * distance}px;--dy:${Math.sin(angle) * distance}px;--r:${Math.round(Math.random() * 180 - 90)}deg"></i>`;
  }).join("")}<b>${isLoss ? "BREAK!" : "+1"}</b>`;
  document.body.append(layer);
  document.body.classList.remove("impact", "game-over-impact");
  void document.body.offsetWidth;
  document.body.classList.add(isLoss ? "game-over-impact" : "impact");
  window.setTimeout(() => {
    layer.remove();
    document.body.classList.remove("impact", "game-over-impact");
  }, isLoss ? 900 : 500);
}

render();
