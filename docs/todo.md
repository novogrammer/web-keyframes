# TODO

## ドキュメント

- preview が `animation-name` ベースで対象を見つける前提と制約を README / README.ja に明記する。
- `time` モードの使い方が分かる example か README 例を追加する。

## 編集 API

- UI から未接続の編集 API を増やす前に、そもそも公開 API として必要かを整理する。
- 残す編集 API がある場合は、「UI から呼ぶのか」「JavaScript 利用者向けに残すのか」を用途ごとに切り分ける。

## テスト

- 複数 timeline を跨ぐ編集や transform 並べ替えなど、実運用に近い操作ケースの回帰テストを追加する。
