# DONE

## 編集モデル

- 固定 transform フィールドを、順序付き transform リストモデルに置き換えた。
- transform の順序を明示的に保持し、記述順をそのまま出力へ反映する。
- `x / y / scale / rotate / opacity` スタイルのモデルから、リストベースの transform 表現へ移行した。
- 最小 transform 項目セットとして `translate`, `scale`, `rotate`, `skew` を扱えるようにした。
- transform の配列順をそのまま CSS 出力順と preview の適用順に反映した。
- transform の内部表現を、JavaScript 側で扱いやすい小さなデータモデルとして明確にした。

## プレビュー

- transform リスト化のあとも、preview 側が生成器と同じ transform 順序を厳密に再現するようにした。

## 編集 API

- 高頻度の修正操作を、JavaScript から呼べる明示的な編集コマンドとして定義した。
- 最小セットとして `nudge`, `offset`, `duplicate`, `spread`, `mirror`, `stagger` を実装した。
- 各操作の対象と変更内容が型と関数シグネチャで分かる API にした。
