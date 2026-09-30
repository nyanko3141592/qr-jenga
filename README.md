# QRジェンガ

読めるQRコードから交互に黒いマスを1つずつ取り除き、読み取れなくしたプレイヤーが負ける2人用ブラウザゲームです。

## 開発

```bash
npm install
npm run dev
```

## テストとビルド

```bash
npm test
npm run build
```

## Cloudflare Workersへ公開

```bash
npm install -g wrangler
npm run deploy
```

## 仕組み

- QRコードの機能パターンは操作できないよう保護
- ゲーム開始時に、読み取れる限界付近まで盤面を自動調整
- 複数の描画サイズで内部スキャンし、端末カメラに依存しない公平な判定
- 最小規格21×21のQRを10×10の操作グリッドでまとめて崩す高速対戦

MIT License
