# Changelog

## [0.3.0](https://github.com/ChasLui/textrank4zh-ts/compare/v0.2.3...v0.3.0) (2026-08-29)

### Features

* 内置词表扩充至 2658 条，中文单字率大幅下降 ([f2d9cc7](https://github.com/ChasLui/textrank4zh-ts/commit/f2d9cc79d531607ff4ad1958671742693e657a5c))
* 支持注入自定义分词器 ([2e90728](https://github.com/ChasLui/textrank4zh-ts/commit/2e9072824cc91a723a5c7330d69fda181037fe91))

### Bug Fixes

* 修复 Pages 演示的 jsDelivr CDN 404，改用 npm 路径 ([5ea8756](https://github.com/ChasLui/textrank4zh-ts/commit/5ea8756f43f77f903a04bc7c8bc5bd542c69f2bb))
* 修复编解码与 Worker 三处缺陷，并按 Rust 式原则强化类型 ([77a0ec8](https://github.com/ChasLui/textrank4zh-ts/commit/77a0ec84a91de966a543b4362025b417f9cbdd39))
* 修正 OIDC 发布的两处认证阻塞 ([71d9be2](https://github.com/ChasLui/textrank4zh-ts/commit/71d9be2451b64d5a42d81a77507df2da63d916a9))
* 发布改用 npm Trusted Publisher (OIDC)，版本号按全部未发布 commit 推断 ([5dc4e24](https://github.com/ChasLui/textrank4zh-ts/commit/5dc4e24ddf78427c40ebf48f6048d054fc313392))

### Performance Improvements

* 内置词表提为模块级 Set，分词提速约 3 倍 ([ee5e1d9](https://github.com/ChasLui/textrank4zh-ts/commit/ee5e1d9817013b3273941170f3044fd999c413dd))

## [0.2.3](https://github.com/ChasLui/textrank4zh-ts/compare/v0.2.2...v0.2.3) (2025-09-11)

### Bug Fixes

* ci ([82f2dcf](https://github.com/ChasLui/textrank4zh-ts/commit/82f2dcf688a9c1155105b7995af453a0a289c939))

## [0.2.2](https://github.com/ChasLui/textrank4zh-ts/compare/v0.1.2...v0.2.2) (2025-09-11)

### Features

* 添加WebWorker跨域修复验证页面 ([ddc5a60](https://github.com/ChasLui/textrank4zh-ts/commit/ddc5a60a948381c07bc509ad913dbdb2479efa2b))

### Bug Fixes

* 修复WebWorker跨域问题，使用同源Worker文件替代CDN ([3730842](https://github.com/ChasLui/textrank4zh-ts/commit/3730842e05b96db857dc38199134912a3609c005))
* 解决Worker脚本路径问题，使用GitHub Pages绝对路径 ([77400fd](https://github.com/ChasLui/textrank4zh-ts/commit/77400fd5896df31eb4c4917bf37d3ca3b8296fa3))

## [0.1.2](https://github.com/ChasLui/textrank4zh-ts/compare/v0.1.1...v0.1.2) (2025-09-11)

### Features

* 添加简单测试示例以演示 TextRank4ZH-TS Worker 功能 ([45e4e39](https://github.com/ChasLui/textrank4zh-ts/commit/45e4e398ea2f92f0f04883992555a699c2361bd0))

### Bug Fixes

* 添加Worker调试测试页面以诊断GitHub Pages问题 ([06c5bbf](https://github.com/ChasLui/textrank4zh-ts/commit/06c5bbf6e9bf94557bbb4d2fffdb52180346c53b))

## [0.1.1](https://github.com/ChasLui/textrank4zh-ts/compare/v0.1.0...v0.1.1) (2025-09-11)

### Features

* add GitHub Actions CI and Codecov integration ([57b777f](https://github.com/ChasLui/textrank4zh-ts/commit/57b777f54aa8bcd12a483a17c41cddc032cac629))
* add GitHub Pages deployment with comprehensive online demos ([dbd1a61](https://github.com/ChasLui/textrank4zh-ts/commit/dbd1a61de68e11c292bf291877803f23b1936d29))
* docs ([025c789](https://github.com/ChasLui/textrank4zh-ts/commit/025c789a84636687eaeff6b3a3cfa7e495b29f14))
* 增强示例和构建配置以支持 typescript-result 兼容实现 ([ffd4bf5](https://github.com/ChasLui/textrank4zh-ts/commit/ffd4bf51baa2f1e3855b5dc931f470cc51a39c10))

### Bug Fixes

* auto release ([4e8cf1e](https://github.com/ChasLui/textrank4zh-ts/commit/4e8cf1ef7002b19af83e60678b5ba1ad6aa68e89))
* github pages ([46c292a](https://github.com/ChasLui/textrank4zh-ts/commit/46c292add6b0453d380962b0d0c98d3cb8112fd5))
* github pages 错误 ([c5b9717](https://github.com/ChasLui/textrank4zh-ts/commit/c5b97176963bc9e5e2c14a1a5d5b224af90de34b))
* ts error ([f4621a4](https://github.com/ChasLui/textrank4zh-ts/commit/f4621a49945fbbc41d2af960ecddf6047a8f17d3))

## 0.1.0 (2025-09-11)

### Features

* initial commit - TextRank4ZH TypeScript implementation with release-it integration ([77f24b0](https://github.com/ChasLui/textrank4zh-ts/commit/77f24b0000296debf919450f6e1666a8d864d57a))
