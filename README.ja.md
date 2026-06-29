# web-keyframes

English: [README.md](./README.md)  
日本語: [README.ja.md](./README.ja.md)

`web-keyframes` は、Web アニメーション向けの軽量なキーフレームデータエディタ兼 CSS 生成ツールです。

できることは 2 つです。

- ブラウザ上のオーバーレイエディタで keyframe document JSON を編集する
- その JSON から CSS の keyframes を生成する

このパッケージは意図的に役割を絞っています。自動保存や特定のビルドツールへの依存は持ちません。

実務上の利点として、最終成果物を素の CSS のまま保てます。制作時は editor と timeline JSON を使い、
本番では生成済みの `@keyframes` だけを配ればよく、editor や JSON のランタイム負荷を持ち込みません。

GitHub install 時は `prepare` により `dist/` を生成する前提です。リポジトリ自体にはビルド済みファイルを含めていません。

## インストール

```bash
npm install github:novogrammer/web-keyframes#v0.5.0
```

## 公開サンプル

- Basic example: https://novogrammer.github.io/web-keyframes/examples/basic/
- Hero animation example: https://novogrammer.github.io/web-keyframes/examples/hero-animation/

## 基本フロー

1. ブラウザ上のエディタで timeline document を作る
2. エディタ UI 上で JSON / CSS を確認してコピーするか、同じ document を API / CLI で CSS に変換する
3. 必要なら本番には生成済み `@keyframes` だけを持ち込む

`generateCss()` が出力するのは `@keyframes` だけです。`animation`、easing、
fill-mode、再生時間などは利用側のスタイルシートで指定します。

`timeline.animationName` が CSS の animation 名で、生成される `@keyframes` と editor
preview の両方が `animationName` を使います。

## 基本的な使い方

### エディタ

```ts
import { WebKeyframesEditor } from "web-keyframes/editor";
import "web-keyframes/editor.css";

const editor = new WebKeyframesEditor({
  root: document.body,
  shortcut: "Ctrl+Shift+K",
});

editor.mount();
```

エディタ UI だけでも、生成された JSON / CSS をその場で確認してコピーできます。
内部実装には `preact` を使っていますが、公開している editor API は小さく、DOM ベースの使い方を維持しています。
ブラウザで `web-keyframes/editor` を直接読み込む場合も、配布される `editor.js` に内部用の `preact` ランタイムを同梱しています。`preact` 用の import map を別途追加する必要はありません。

## CSS へ変換する

CSS を得る経路は 3 つあります。エディタから直接書き出す方法、アプリケーションコードから変換する方法、
CLI で変換する方法です。

### エディタ UI

オーバーレイエディタを開き、timeline を編集し、組み込みの JSON / CSS パネルで現在の出力を確認または
コピーできます。

preview は、現在の document 内に `timeline.animationName` と一致する computed
`animation-name` を持つ要素があることを前提にしています。

- preview は、現在の document 内で一致した `animation-name` だけを一時的に差し替えます
- selector や class 名から対象を推測することはしません
- `Reset Preview` は、一時的に追加した preview style と inline の `animation-name` 上書きを戻します

### API

```ts
import { generateCss } from "web-keyframes";

const css = generateCss({
  timelines: [
    {
      animationName: "hero-logo",
      positionType: "time",
      duration: 1200,
      keyframes: [
        {
          time: 0,
          properties: [
            { kind: "opacity", value: 0 },
            {
              kind: "transform",
              value: [
                { kind: "translate", x: 0, y: 40 },
                { kind: "scale", x: 1, y: 1 },
                { kind: "rotate", value: 0 }
              ]
            }
          ]
        },
        {
          time: 1200,
          properties: [
            { kind: "opacity", value: 1 }
          ]
        }
      ]
    }
  ]
});
```

### CLI

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

各入力ファイルは 1 個以上の timeline を持てます。ディレクトリ入力時は、ファイル名順で読み込み、
空行を挟んで結合します。

### 生成した keyframes を適用

```css
.hero-logo {
  animation: hero-logo 1200ms ease-out both;
}
```

### `time` モードの例

ミリ秒ベースでキーフレーム位置を置きたい場合は `positionType: "time"` を使います。

```json
{
  "timelines": [
    {
      "animationName": "hero-logo",
      "positionType": "time",
      "duration": 1200,
      "keyframes": [
        { "time": 0, "properties": [{ "kind": "opacity", "value": 0 }] },
        { "time": 700, "timingFunction": "ease-out" },
        { "time": 1200, "properties": [{ "kind": "opacity", "value": 1 }] }
      ]
    }
  ]
}
```

## 公開 API

公開面は意図的に小さくしています。

- root export: `generateCss()`
- editor export: `web-keyframes/editor` の `WebKeyframesEditor`

### エディタのメソッド

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

`initialData` と `setData()` は妥当な timeline JSON を前提とし、validation に失敗した場合は例外を投げます。

## Timeline JSON

```json
{
  "timelines": [
    {
      "animationName": "hero-logo",
      "positionType": "time",
      "duration": 1200,
      "translateConfig": {
        "unit": "px"
      },
      "keyframes": [
        {
          "time": 0,
          "timingFunction": "ease-out",
          "properties": [
            { "kind": "opacity", "value": 0 },
            {
              "kind": "transform",
              "value": [
                { "kind": "translate", "x": 0, "y": 40 },
                { "kind": "scale", "x": 1, "y": 1 },
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
                { "kind": "scale", "x": 1, "y": 1 },
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

document は `timelines[]` を持ち、各 timeline が自分の `animationName`、`positionType`、
`translateConfig`、`keyframes` を持ちます。

- `animationName`: 生成される `@keyframes` と editor preview に使う CSS animation 名
- `positionType`: 必須の位置指定モード。`time` または `percent`
- `translateConfig.unit`: `px`, `vw`, `vh`, `vmin`, `vmax`, `%`, `em`, `rem` のいずれか

timeline の位置指定モードは 2 種類あります。

- `time` モード: 各キーフレームが `time` を持ち、timeline に `duration` が必要
- `percent` モード: 各キーフレームが `percent` を持ち、timeline に `duration` は持てない

この JSON は、CSS の `@keyframes` を生成するための軽量な中間表現であり、密なスナップショット形式ではありません。
各キーフレームは、その位置で出力したい property だけを書けば十分です。

各キーフレームの `properties` と `timingFunction` は省略できます。property を省略した場合、その
キーフレームではその CSS property を出力しません。

各キーフレームは、property を持つ場合にアニメーションする値を順序付きの `properties[]` で表現します。
`transform` はその中で `value[]` に順序付き operation を持ち、その順番は生成 CSS にも反映されます。

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
