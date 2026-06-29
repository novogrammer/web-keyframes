# DONE

## 編集モデル

- 固定 transform フィールドを、順序付き transform リストモデルに置き換えた。
- transform の順序を明示的に保持し、記述順をそのまま出力へ反映する。
- `x / y / scale / rotate / opacity` スタイルのモデルから、リストベースの transform 表現へ移行した。
- 最小 transform 項目セットとして `translate`, `scale`, `rotate`, `skew` を扱えるようにした。
- transform の配列順をそのまま CSS 出力順と preview の適用順に反映した。
- transform の内部表現を、JavaScript 側で扱いやすい小さなデータモデルとして明確にした。
- タイムライン UI の複雑化より先に、transform 順序を失わないデータ構造を確定した。
- keyframe ごとの animated value を `properties[]` で表す形に整理し、`opacity` と `transform` を同列に扱えるようにした。
- `scale` は常に `x` / `y` を持つモデルに統一し、CSS 出力も常に `scale(x, y)` に揃えた。
- keyframe 単位の `timingFunction` を文字列フィールドとして追加し、CSS の `animation-timing-function` へそのまま出力できるようにした。
- sparse な keyframe JSON を editor が勝手に密化せず、読み込みと書き出しで同じ形を維持するようにした。
- keyframe の位置指定を `time` と `percent` の別 field に分離し、`duration` は `time` モードの timeline にだけ持たせる形へ整理した。
- timeline JSON は `positionType` 必須の正規形に寄せ、keyframe field から位置モードを推測しない方針にした。
- editor core の高頻度編集を、`field` 名文字列ベースの分岐から、timeline / keyframe ごとの意味ベース action へ置き換えた。
- `EditorApp.tsx` は「どの input 名が変わったか」ではなく「何を変更したいか」を core へ渡す薄い変換層へ寄せた。

## プレビュー

- transform リスト化のあとも、preview 側が生成器と同じ transform 順序を厳密に再現するようにした。
- preview は現在の軽量な DOM リプレイの範囲で十分と判断した。
- `animation-name` ベースの対象検出は、現状の利用形態では十分信頼できることを確認した。
- 複数の対象が同じ animation 名を共有するケースでも、preview は個別に正しく反映されることを確認した。
- preview 生成も timeline JSON の sparse な keyframe 記述をそのまま尊重する前提に揃えた。
- README / README.ja に、preview が computed `animation-name` ベースで対象を見つける前提と制約を明記した。

## 編集 API

- 公開 API は `generateCss()` と `WebKeyframesEditor` の小さい面に絞る方針を維持した。
- transform 編集については、kind 変更 / 並べ替え / 追加 / 削除 / 値更新を扱う内部 helper を core 側に整理した。
- editor UI からの高頻度編集は、input 名の文字列解釈ではなく、意味ベース action を通して core へ渡す形に整理した。

## プロダクト方針

- `theatre.js` のような高機能タイムラインツールを目指すのではなく、Web 向け keyframes 編集に必要な最小機能へ絞る方針を明確にした。
- 汎用的な自由操作 UI を広げるより、プログラム側で定義した意味の明確な編集操作を強くする方針を明確にした。

## UX

- `theatre.js` 的な汎用シーケンサー UI を持ち込まず、このツールに必要な範囲で順序編集 UI を設計する方針を明確にした。
- `timingFunction` の入力 UI は、構造化フォームではなく text を主にしてプリセットボタンで補助する形にした。
- keyframe 追加時は既存値を複製せず、`properties: []` の空状態から編集を始めるようにした。
- `src/editor/WebKeyframesEditor.ts` の責務を整理し、描画用データ整形と preview 適用ロジックを別モジュールへ分離した。
- editor UI の Lit 化を検討したが、現段階では導入しない判断にした。
- overlay editor の描画を `preact` ベースへ置き換え、公開 API を変えずにコンポーネント単位で UI を整理した。
- selected keyframe editor の長い表示ロジックを、timing function / property add / opacity の単位へ分割して読みやすさを上げた。
- overlay editor の見た目は、実装を広げずに視覚階層と一覧の読みやすさを中心に小さく調整した。

## Examples

- `examples/basic` を、editor 初期値を JS に埋め込む方式から timeline JSON を読み込む方式へ揃えた。
- examples の timeline JSON を `percent` ベースへ揃えた。
- `examples/basic` に keyframe 単位の `timingFunction` 使用例を追加した。
- `examples/hero-animation` を `hello-theatrejs` の構成から移植し、`100vw` 前提の hero と説明文配置を含めて example として整えた。
- README / README.ja に `time` モードの使い方が分かる例を追加した。

## テスト

- 複数 timeline を跨いだ編集で、選択中 timeline の変更が他 timeline を汚さないことを回帰テストで確認した。
- transform 並べ替えが selected keyframe の transform 順序と CSS 出力へ反映されることを回帰テストで確認した。
