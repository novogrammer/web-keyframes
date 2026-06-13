# web-keyframes handoff

## 目的

`web-keyframes` は、Webアニメーション用の軽量キーフレーム作成ツールである。

Flash風のタイムライン編集体験を参考にしつつ、Flashの代替を作るのではなく、Web制作で使うCSS/SCSSアニメーションのキーフレームデータを作成し、SCSSへ変換することに目的を絞る。

## 作りたいもの

Webアニメーション用のキーフレームJSONを作り、そのJSONからSCSSを生成するツールを作る。

初期版では以下を作る。

* npmパッケージ
* importしたclassを明示的に初期化するブラウザ用エディタ
* キーフレームデータ編集UI
* JSONコピー機能
* SCSSコピー機能
* JSONからSCSSへ変換するCLI
* ビルドツール非依存の構成

## 初期版で作らないもの

初期版ではpreview機能を作らない。

つまり、以下は作らない。

* 対象DOMへのinline style適用
* 実ページ上でのアニメーション確認
* 対象要素の `document.querySelector()` による取得
* 既存transformとの合成
* inline styleの退避・復元
* Reset Preview
* iframeプレビュー
* 自動mount
* `window.webKeyframes` のようなグローバルAPI
* File System Access API
* ローカルファイルへの自動保存
* Vite plugin
* Webpack plugin
* HMR連携
* 生成済みCSSの解析
* Source Mapから元SCSSへ戻す処理
* Figma連携
* ベクター作画ツール
* 画像配置ツール
* 音声同期
* 複雑なUndo/Redo
* 複数ページ管理
* Flash/FLA互換

## 基本方針

エディタの実体は、キーフレームJSONを作るGUIである。

CSSやSCSSを直接編集するのではなく、内部ではJSON相当のデータを持つ。
そのデータからSCSS文字列を生成する。

初期版ではファイル保存処理を持たない。
保存や反映は人間が行う。

初期版の出力は以下。

* Copy JSON
* Copy SCSS
* CLIによる JSON to SCSS

## リポジトリ名

`web-keyframes`

## パッケージ方針

npmパッケージとして作る。

ただし、最初はnpmjsへ公開しなくてよい。GitHubリポジトリからnpm installできる形を想定する。

利用側の例:

```bash
npm install github:YOUR_NAME/web-keyframes#v0.1.0
```

`package.json` の例:

```json
{
  "devDependencies": {
    "web-keyframes": "github:YOUR_NAME/web-keyframes#v0.1.0"
  }
}
```

## 技術方針

### エディタ

エディタはビルドツール非依存にする。

Vite / Webpack / Gulp / Astro / 11ty などの特定ビルドツールには依存しない。

ただし、npmパッケージとしてimportして使えるようにする。

利用側の例:

```ts
import { WebKeyframesEditor } from "web-keyframes/editor";
import "web-keyframes/editor.css";

const editor = new WebKeyframesEditor({
  root: document.body,
  shortcut: "Ctrl+Shift+K"
});

editor.mount();
```

直接HTMLから使う場合の例:

```html
<link rel="stylesheet" href="/tools/web-keyframes/editor.css">

<script type="module">
  import { WebKeyframesEditor } from "/tools/web-keyframes/editor.js";

  const editor = new WebKeyframesEditor({
    root: document.body,
    shortcut: "Ctrl+Shift+K"
  });

  editor.mount();
</script>
```

### 起動方針

エディタは自動mountしない。

利用側が `WebKeyframesEditor` classをimportし、明示的に初期化する。

```ts
const editor = new WebKeyframesEditor({
  root: document.body
});

editor.mount();
```

`window.webKeyframes` のようなグローバルAPIは作らない。

表示/非表示はインスタンスメソッドで行う。

```ts
editor.show();
editor.hide();
editor.toggle();
```

ショートカットを有効にする場合はoptionで指定する。

```ts
const editor = new WebKeyframesEditor({
  root: document.body,
  shortcut: "Ctrl+Shift+K"
});
```

### CLI

JSONからSCSSを生成するCLIも同梱する。

CLIはNode.jsで動く。
TypeScript実行のために `tsx` を使ってよい。

利用側のnpm scripts例:

```json
{
  "scripts": {
    "gen:animations": "web-keyframes to-scss --input src/animations --output src/assets/css/generated/_animations.generated.scss"
  }
}
```

パスはプロジェクト依存なので、CLI内部に固定しない。
`package.json` のnpm scripts側に書く。

## 想定ディレクトリ構成

```txt
web-keyframes/
  package.json
  README.md
  src/
    editor/
      WebKeyframesEditor.ts
      editor.css
      index.ts
    core/
      types.ts
      validate.ts
      normalize.ts
      generateScss.ts
      formatScss.ts
      index.ts
    cli/
      index.ts
  dist/
    editor.js
    editor.css
    index.js
  bin/
    web-keyframes.js
```

## package.jsonの想定

```json
{
  "name": "web-keyframes",
  "version": "0.1.0",
  "type": "module",
  "files": [
    "dist",
    "bin"
  ],
  "exports": {
    ".": "./dist/index.js",
    "./editor": "./dist/editor.js",
    "./editor.css": "./dist/editor.css"
  },
  "bin": {
    "web-keyframes": "./bin/web-keyframes.js"
  },
  "scripts": {
    "build": "tsup src/editor/index.ts src/core/index.ts src/cli/index.ts --format esm --dts",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "tsup": "^8.0.0"
  }
}
```

`tsup` は仮。別の軽いビルド手段でもよい。
ただし、Vite/Webpack等の特定のアプリビルドツールには依存しない。

## エディタAPI

### Constructor

```ts
type WebKeyframesEditorOptions = {
  root: HTMLElement;
  initialData?: WebKeyframesData;
  shortcut?: string | false;
};

const editor = new WebKeyframesEditor(options);
```

### Methods

```ts
editor.mount(): void;
editor.unmount(): void;

editor.show(): void;
editor.hide(): void;
editor.toggle(): void;

editor.getData(): WebKeyframesData;
editor.setData(data: WebKeyframesData): void;

editor.toJson(): string;
editor.toScss(): string;
```

### 挙動

* `mount()` で `root` 配下にエディタDOMを追加する
* 初期状態では非表示
* `show()` で表示する
* `hide()` で非表示にする
* `toggle()` で表示/非表示を切り替える
* `unmount()` でDOMとイベントリスナーを削除する
* `shortcut: false` の場合はショートカットを登録しない

## 初期UI仕様

overlay形式のUIにする。
ただし、初期版では実ページ上のDOMを操作しない。

下固定のパネルでよい。

```txt
┌────────────────────────────────────┐
│ 実サイト                            │
│                                    │
├────────────────────────────────────┤
│ web-keyframes editor               │
│ keyframe data editor               │
└────────────────────────────────────┘
```

最低限のUI:

* ID input
* Target selector input
* Duration input
* Design width input
* Unit function input
* Time slider
* Keyframe list
* Add keyframe button
* Delete keyframe button
* Property editor

  * x
  * y
  * scale
  * rotate
  * opacity
* Copy JSON button
* Copy SCSS button

## Target selectorの扱い

初期版では `target` はプレビュー対象ではない。

`target` は、生成SCSSでアニメーションを適用するselectorとして扱う。

例:

```json
{
  "target": ".js-hero-logo"
}
```

SCSS出力:

```scss
.js-hero-logo {
  animation: hero-logo 1200ms ease-out forwards;
}
```

## 編集対象プロパティ

初期版では以下だけを扱う。

```txt
x
y
scale
rotate
opacity
```

## 単位方針

Web制作向けなので、px固定にはしない。

ただし、初期版では編集値は「デザインカンプ上のpx」として持つ。

* `x` はカンプpx
* `y` はカンプpx
* `scale` は数値
* `rotate` はdeg
* `opacity` は数値

SCSS出力時に、`x` / `y` を指定したSCSS関数へ渡す。

例:

```json
{
  "unitFunction": "global.vw",
  "keyframes": [
    {
      "time": 0,
      "x": 0,
      "y": 40,
      "scale": 1,
      "rotate": 0,
      "opacity": 0
    }
  ]
}
```

SCSS出力:

```scss
transform: translate(global.vw(0), global.vw(40)) scale(1) rotate(0deg);
opacity: 0;
```

`unitFunction` の初期値は `global.vw` とする。

## JSON形式

初期版のデータ形式は以下。

```json
{
  "id": "hero-logo",
  "target": ".js-hero-logo",
  "duration": 1200,
  "designWidth": 1440,
  "unitFunction": "global.vw",
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

`designWidth` は初期版では主にメタ情報として持つ。
previewを作らないため、初期版では直接使用しなくてもよい。

## TypeScript型

```ts
export type WebKeyframesData = {
  id: string;
  target: string;
  duration: number;
  designWidth: number;
  unitFunction: string;
  keyframes: WebKeyframe[];
};

export type WebKeyframe = {
  time: number;
  x: number;
  y: number;
  scale: number;
  rotate: number;
  opacity: number;
};
```

## SCSS生成仕様

JSONから以下のようなSCSS文字列を生成する。

```scss
@keyframes hero-logo {
  0% {
    transform: translate(global.vw(0), global.vw(40)) scale(1) rotate(0deg);
    opacity: 0;
  }

  100% {
    transform: translate(global.vw(0), global.vw(0)) scale(1) rotate(0deg);
    opacity: 1;
  }
}

.js-hero-logo {
  animation: hero-logo 1200ms ease-out forwards;
}
```

`unitFunction` はJSONに持たせる。
未指定の場合は `global.vw` とする。

## keyframe percent変換

* `time` 昇順に並べる
* `time / duration * 100` でpercentを求める
* percentは最大3桁程度に丸める

例:

```txt
time: 0 / duration: 1200    => 0%
time: 600 / duration: 1200  => 50%
time: 1200 / duration: 1200 => 100%
```

## Copy JSON

現在の編集状態を整形済みJSONとしてクリップボードへコピーする。

```ts
JSON.stringify(data, null, 2)
```

## Copy SCSS

現在の編集状態からSCSS文字列を生成してクリップボードへコピーする。

## CLI仕様

CLI名:

```bash
web-keyframes
```

初期サブコマンド:

```bash
web-keyframes to-scss --input <path> --output <path>
```

`--input` はファイルまたはディレクトリを受ける。

* ファイルの場合: そのJSONだけ変換
* ディレクトリの場合: `*.timeline.json` をまとめて変換

例:

```bash
web-keyframes to-scss --input src/animations --output src/assets/css/generated/_animations.generated.scss
```

## CLIの生成仕様

複数ファイルの場合は、各SCSSを空行2つで結合する。

出力先ディレクトリがなければ作る。

JSON parse errorは、どのファイルで失敗したか分かるようにする。

## 入力ファイル名

CLIでディレクトリを指定した場合、対象は以下とする。

```txt
*.timeline.json
```

例:

```txt
hero-logo.timeline.json
section-title.timeline.json
```

## エラー処理

最低限、以下を扱う。

* idが空
* targetが空
* durationが0以下
* keyframeが2つ未満
* timeが0未満
* timeがdurationを超えている
* JSONが不正
* CLIのinputが存在しない
* CLIのoutputが未指定
* `mount()` が二重に呼ばれた
* `root` が存在しない

## CSS設計

エディタ側のCSSはサイト側と衝突しにくい命名にする。

prefix:

```txt
__wkf-
```

root:

```css
.__wkf-root {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 280px;
  z-index: 2147483647;
  display: none;
  background: #111;
  color: #fff;
  font: 12px/1.4 system-ui, sans-serif;
}
```

サイト側への影響を避けるため、グローバルな `button` や `input` selectorは使わない。

## 初期実装の優先順位

1. 型定義
2. JSON validation
3. SCSS生成
4. CLI `to-scss`
5. `WebKeyframesEditor` class
6. `mount()` / `unmount()`
7. `show()` / `hide()` / `toggle()`
8. ID / target / duration / designWidth / unitFunction の入力
9. keyframe list
10. property editor
11. Add keyframe
12. Delete keyframe
13. Copy JSON
14. Copy SCSS

## 完了条件

初期版の完了条件は以下。

* `WebKeyframesEditor` をimportできる
* `new WebKeyframesEditor({ root })` で初期化できる
* `mount()` でエディタDOMが追加される
* 初期状態では非表示
* `show()` / `hide()` / `toggle()` が動く
* `unmount()` でDOMとイベントリスナーが削除される
* id / target / duration / designWidth / unitFunction を編集できる
* x / y / scale / rotate / opacity のキーフレームを編集できる
* Copy JSONできる
* Copy SCSSできる
* `web-keyframes to-scss --input ... --output ...` が動く
* Vite/Webpack/Gulp等に依存していない
* ローカルファイルへ自動保存しない
* 対象DOMへinline styleを当てない
* `window.webKeyframes` のようなグローバルAPIを作らない

## 将来追加してもよいもの

初期版のあとに検討する。

* preview
* easing
* 複数ターゲット
* 複数タイムライン
* キーフレームのドラッグ移動
* レイヤーUI
* JSON import
* localStorageによる一時保存
* GSAP出力
* WAAPI出力
* CSS custom properties出力
* `rem` / `%` / `vw` / `cqw` などの単位選択
* `clamp()` / `calc()` の手入力
* npmjs公開

## Codexへの進め方

まず全体を一気に作らず、以下の順番で小さく実装する。

1. `core` の型・validation・SCSS生成を作る
2. CLIでJSONからSCSSを生成できるようにする
3. `WebKeyframesEditor` classを作る
4. `mount()` で非表示overlayが追加されるようにする
5. `show()` / `hide()` / `toggle()` を追加する
6. UIからJSON相当の状態を編集できるようにする
7. Copy JSON / Copy SCSSを足す

各段階で簡単な動作確認コマンドを用意する。
