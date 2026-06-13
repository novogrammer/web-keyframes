# リリース手順

このプロジェクトは現在、npm 公開ではなく GitHub タグ経由で install する前提です。

English: [release.md](./release.md)  
日本語: [release.ja.md](./release.ja.md)

## バージョン管理

- `package.json` の `version` を更新する
- [CHANGELOG.md](../CHANGELOG.md) に新しいセクションを追加する
- 必要なら [README.md](../README.md) と [README.ja.md](../README.ja.md) の install 例を次のタグへ揃える

## リリース前チェック

リポジトリルートで以下を実行します。

```bash
npm install
npm run build
npm run typecheck
node --test
```

期待結果:

- `dist/` が正常に再生成される
- typecheck が通る
- すべてのテストが通る

## リリース手順

1. 作業ツリーを確認し、含める変更をコミットする。
2. `package.json` の version を上げる。
3. `CHANGELOG.md` に日付と変更内容を追記する。
4. 検証コマンドを再実行する。
5. 必要ならリリース用メタデータ更新をコミットする。
6. 注釈付きタグを作成する。例:

```bash
git tag -a v0.1.0 -m "web-keyframes v0.1.0"
```

7. ブランチとタグを push する。

```bash
git push origin main
git push origin v0.1.0
```

## GitHub からの install

利用側はタグを指定して install します。

```bash
npm install github:novogrammer/web-keyframes#v0.1.0
```

## 補足

- `dist/` は git 管理していません。
- GitHub install 時は `prepare` によりソースから `dist/` を生成します。
- `prepack` でも `dist/` を再生成するため、ローカル tarball や将来の npm publish でも同じビルド経路を使います。
