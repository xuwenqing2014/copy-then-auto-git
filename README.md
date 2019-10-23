webpack插件 copy-then-auto-git
====================

### 用于自动拷贝静态资源、自动提交到远程仓库

## 前提

需要 Node 版本在 v8.0 以上

## 安装

`npm install copy-then-auto-git -D`

## 使用指南

支持的配置项:

+ `assetsDir` 静态资源需要拷贝到的目标路径（无需配置静态资源的来源路径，因为webpack能直接获取到编译后的静态资源），默认是publish
+ `inculdes` 需要拷贝的静态资源文件名正则的集合，比如`[/^.*\.html$/]`，无默认值
+ `exculdes` 不需要拷贝的静态资源文件名正则的集合，比如`[/^.*\.html$/]`，无默认值
+ `retry` 如果拷贝失败，重试的次数，默认是3
+ `gitDir` 执行git命令的根路径，默认是publish
+ `branch` 执行git命令的分支名，默认是master
+ `version` 自动提交时的版本号，默认是当前时间的毫秒数

```js
// 引入
const CopyThenAutoGit = require('copy-then-auto-git');

// 配置 Plugin
const copyThenAutoGit = new CopyThenAutoGit({
    assetsDir: 'publish',
    gitDir: 'publish',
    inculdes: [/^.*\.html$/],
    exculdes: [/^.*\.html$/],
    retry: 3,
    branch: 'dev',
    version: new Date().getTime()
});

// Webpack 的配置
module.exports = {
//...
 plugins: [
   copyThenAutoGit
   // ...
 ]
 // ...
}
```
