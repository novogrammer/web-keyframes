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

## プレビュー

- transform リスト化のあとも、preview 側が生成器と同じ transform 順序を厳密に再現するようにした。
- preview は現在の軽量な DOM リプレイの範囲で十分と判断した。
- `animation-name` ベースの対象検出は、現状の利用形態では十分信頼できることを確認した。
- 複数の対象が同じ animation 名を共有するケースでも、preview は個別に正しく反映されることを確認した。
- preview 生成も timeline JSON の sparse な keyframe 記述をそのまま尊重する前提に揃えた。

## 編集 API

- 高頻度の修正操作を、JavaScript から呼べる明示的な編集コマンドとして定義した。
- 最小セットとして `nudge`, `offset`, `duplicate`, `spread`, `mirror`, `stagger` を実装した。
- 各操作の対象と変更内容が型と関数シグネチャで分かる API にした。
- 単一値編集だけでなく、複数キーフレームや複数 transform への一括操作を前提にした編集 API を用意した。
- キーボードショートカットや将来の CLI 拡張でも再利用できる操作語彙を core API として切り出した。

## プロダクト方針

- `theatre.js` のような高機能タイムラインツールを目指すのではなく、Web 向け keyframes 編集に必要な最小機能へ絞る方針を明確にした。
- 汎用的な自由操作 UI を広げるより、プログラム側で定義した意味の明確な編集操作を強くする方針を明確にした。

## UX

- `theatre.js` 的な汎用シーケンサー UI を持ち込まず、このツールに必要な範囲で順序編集 UI を設計する方針を明確にした。
- 自由な直接操作より、JavaScript 側で定義した `nudge` や `range` のような定型操作を UI から呼び出す方針を優先することを確認した。
- `timingFunction` の入力 UI は、構造化フォームではなく text を主にしてプリセットボタンで補助する形にした。
- keyframe 追加時は既存値を複製せず、`properties: []` の空状態から編集を始めるようにした。
- `src/editor/WebKeyframesEditor.ts` の責務を整理し、描画用データ整形と preview 適用ロジックを別モジュールへ分離した。
- editor UI の Lit 化を検討したが、現段階では導入しない判断にした。
- overlay editor の描画を `preact` ベースへ置き換え、文字列テンプレート描画と DOM 委譲中心の構成を整理した。

## Examples

- `examples/basic` を、editor 初期値を JS に埋め込む方式から timeline JSON を読み込む方式へ揃えた。
- examples の timeline JSON を `percent` ベースへ揃えた。
- `examples/basic` に keyframe 単位の `timingFunction` 使用例を追加した。
- `examples/hero-animation` を `hello-theatrejs` の構成から移植し、`100vw` 前提の hero と説明文配置を含めて example として整えた。
