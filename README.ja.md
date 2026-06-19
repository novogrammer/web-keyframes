# web-keyframes

English: [README.md](./README.md)  
日本語: [README.ja.md](./README.ja.md)

`web-keyframes` は、Web アニメーション向けの軽量なキーフレームデータエディタ兼 CSS 生成ツールです。

できることは 2 つです。

- ブラウザ上のオーバーレイエディタで keyframe document JSON を編集する
- その JSON から CSS の keyframes を生成する

このパッケージは意図的に役割を絞っています。自動保存や特定のビルドツールへの依存は持ちません。

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
editor.toCss();
```

### 現在のエディタ機能

- 1 つの document 内で複数 timeline を管理
- 選択中 timeline の `id`、`duration`、translate 出力設定の編集
- 選択中キーフレーム `time`、`opacity`、順序付き transform の編集
- `translate`、`scale`、`rotate`、`skew` の追加・並べ替え・種類変更・削除
- timeline の追加、複製、選択、削除
- キーフレームの追加、複製、削除
- 生成された JSON / CSS のエディタ内プレビュー
- 同じ `animation-name` を使っている実 DOM 要素に対する軽量 preview
- その preview の解除
- JSON のコピー
- CSS のコピー
- デフォルト状態へのリセット
- 任意ショートカットによる表示切り替え
- `Escape` によるプレビューのクローズ

### 現在の制約

- preview は `document` 内に対象要素が存在し、かつ選択中 timeline の `id` と同じ `animation-name` を使っている場合にだけ動作する
- ファイル import や自動保存はしない
- easing エディタはまだない

### Preview の挙動

`Preview` ボタンは、現在のドキュメント全体から computed style の `animation-name`
が選択中 timeline の `id` と一致する要素を探します。

一致する要素が見つかった場合、エディタは以下を行います。

- 一時的な keyframes 名で browser-safe な preview CSS を生成する
- `<head>` の末尾に preview 用 `<style>` を 1 枚だけ挿入または更新する
- 一致した要素の `animation-name` を一時的に差し替えて再生し直す

`Reset Preview` を押すと、一時的な `<style>` を削除し、対象要素の inline `animation-name`
を元に戻します。

## データ形式

```json
{
  "timelines": [
    {
      "id": "hero-logo",
      "duration": 1200,
      "translate": {
        "unit": "px"
      },
      "keyframes": [
        {
          "time": 0,
          "properties": [
            { "kind": "opacity", "value": 0 },
            {
              "kind": "transform",
              "value": [
                { "kind": "translate", "x": 0, "y": 40 },
                { "kind": "scale", "value": 1 },
                { "kind": "rotate", "value": 0 }
              ]
            }
          ]
        },
        {
          "time": 1200,
          "properties": [
            { "kind": "opacity", "value": 1 },
            {
              "kind": "transform",
              "value": [
                { "kind": "translate", "x": 0, "y": 0 },
                { "kind": "scale", "value": 1 },
                { "kind": "rotate", "value": 0 }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

document は `timelines[]` を持ち、各 timeline が自分の `id`、`duration`、`translate`、`keyframes` を持ちます。

各キーフレームは、アニメーションする値を順序付きの `properties[]` で表現します。`transform` はその中で `value[]` に順序付き operation を持ちます。`x`、`y`、`scale`、`rotate`、`skewX`、`skewY` などの legacy なトップレベル field は受け付けません。

`opacity` と `transform` は、CSS の sparse keyframe に合わせて、キーフレームごとに `properties[]` から省略できます。

- `opacity` property が省略: そのキーフレームでは `opacity` を出力しません
- `transform` property が省略: そのキーフレームでは `transform` を出力しません
- `transform` property の `"value": []`: `transform: none;` を出力します

一方、エディタ内部の編集 helper では操作を安定させるため、省略値は直前キーフレームから解決して扱います。

## CLI

単一ファイルを変換する例:

```bash
web-keyframes to-css \
  --input src/animations/hero-logo.timeline.json \
  --output src/assets/css/generated/hero-logo.css
```

`*.timeline.json` をまとめて 1 ファイルへ出力する例:

```bash
web-keyframes to-css \
  --input src/animations \
  --output src/assets/css/generated/animations.css
```

各入力ファイルは 1 個以上の timeline を持てます。ディレクトリ入力時は、ファイル名順で読み込み、空行を挟んで結合します。

## 出力例

```css
@keyframes hero-logo {
  0% {
    transform: translate(0px, 40px) scale(1) rotate(0deg);
    opacity: 0;
  }

  100% {
    transform: translate(0px, 0px) scale(1) rotate(0deg);
    opacity: 1;
  }
}
```

`translate.unit` で `px`、`vw`、`vh`、`%`、または独自単位トークンを選べます。  
transform 配列の順番は `generateCss()` と `generatePreviewCss()` の両方でそのまま維持されます。
`generateCss()` は `@keyframes` だけを出力します。`animation`、`animation-name`、easing、fill-mode などは利用側のスタイルシートで指定してください。
`generatePreviewCss()` は preview 用の browser-safe な CSS を出力します。

## 開発

```bash
npm install
npm run build
npm run typecheck
npm test
```

## リリース

- 変更履歴: [CHANGELOG.md](./CHANGELOG.md)
- リリース手順: [docs/release.md](./docs/release.md)
- 日本語のリリース手順: [docs/release.ja.md](./docs/release.ja.md)
