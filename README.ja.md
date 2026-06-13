# web-keyframes

English: [README.md](./README.md)  
日本語: [README.ja.md](./README.ja.md)

`web-keyframes` は、Web アニメーション向けの軽量なキーフレームデータエディタ兼 SCSS 生成ツールです。

できることは 2 つです。

- ブラウザ上のオーバーレイエディタでタイムライン JSON を編集する
- その JSON から SCSS の keyframes と animation ルールを生成する

このパッケージは意図的に役割を絞っています。実 DOM へのプレビュー適用、自動保存、特定のビルドツールへの依存は持ちません。

GitHub install 時は `prepare` により `dist/` を生成する前提です。リポジトリ自体にはビルド済みファイルを含めていません。

## インストール

```bash
npm install github:novogrammer/web-keyframes#v0.1.0
```

## エディタ

```ts
import { WebKeyframesEditor } from "web-keyframes/editor";
import "web-keyframes/editor.css";

const editor = new WebKeyframesEditor({
  root: document.body,
  shortcut: "Ctrl+Shift+K",
});

editor.mount();
```

### 利用できるメソッド

```ts
editor.mount();
editor.unmount();

editor.show();
editor.hide();
editor.toggle();

editor.getData();
editor.setData(data);

editor.toJson();
editor.toScss();
```

### 現在のエディタ機能

- `id`、`target`、`duration`、`designWidth`、translate 出力設定の編集
- キーフレーム `time`、`x`、`y`、`scale`、`rotate`、`opacity` の編集
- キーフレームの追加、複製、削除
- 生成された JSON / SCSS のエディタ内プレビュー
- JSON のコピー
- SCSS のコピー
- デフォルト状態へのリセット
- 任意ショートカットによる表示切り替え
- `Escape` によるプレビューのクローズ

### 現在の制約

- 実 DOM 要素へのプレビューはしない
- ファイル import や自動保存はしない
- easing エディタはまだない
- 複数タイムライン管理はまだない

## データ形式

```json
{
  "id": "hero-logo",
  "target": ".js-hero-logo",
  "duration": 1200,
  "designWidth": 1440,
  "translate": {
    "unit": "px",
    "functionName": "global.vw"
  },
  "keyframes": [
    {
      "time": 0,
      "x": 0,
      "y": 40,
      "scale": 1,
      "rotate": 0,
      "opacity": 0
    },
    {
      "time": 1200,
      "x": 0,
      "y": 0,
      "scale": 1,
      "rotate": 0,
      "opacity": 1
    }
  ]
}
```

## CLI

単一ファイルを変換する例:

```bash
web-keyframes to-scss \
  --input src/animations/hero-logo.timeline.json \
  --output src/assets/css/generated/_hero-logo.scss
```

`*.timeline.json` をまとめて 1 ファイルへ出力する例:

```bash
web-keyframes to-scss \
  --input src/animations \
  --output src/assets/css/generated/_animations.generated.scss
```

ディレクトリ入力時は、ファイル名順で読み込み、空行を挟んで結合します。

## 出力例

```scss
@keyframes hero-logo {
  0% {
    transform: translate(global.vw(0px), global.vw(40px)) scale(1) rotate(0deg);
    opacity: 0;
  }

  100% {
    transform: translate(global.vw(0px), global.vw(0px)) scale(1) rotate(0deg);
    opacity: 1;
  }
}

.js-hero-logo {
  animation: hero-logo 1200ms ease-out forwards;
}
```

`translate.unit` で `px`、`vw`、`vh`、`%`、または独自単位トークンを選べます。  
`translate.functionName` は任意で、指定すると `40px` ではなく `customFn(40px)` のように出力されます。

## 開発

```bash
npm install
npm run build
npm run typecheck
node --test
```

## リリース

- 変更履歴: [CHANGELOG.md](./CHANGELOG.md)
- リリース手順: [docs/release.md](./docs/release.md)
- 日本語のリリース手順: [docs/release.ja.md](./docs/release.ja.md)
