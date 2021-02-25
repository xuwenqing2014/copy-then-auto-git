webpack插件 copy-then-auto-git
====================

### 用于自动拷贝静态资源、自动提交到远程仓库

### 插件能帮助我们做什么？插件会按步骤自动进行以下工作

+ 在gitDir路径下切换branch分支
+ git pull远程仓库branch分支代码
+ 删除destination路径下资源
+ 拷贝source路径的资源到destination路径
+ git add、git commit、git push 推送到远程仓库的branch分支

## 前提

需要 Node 版本在 v8.0 以上

## 安装

`npm install copy-then-auto-git -D`

## 使用指南

支持的配置项:

+ `source` 静态资源需要拷贝的来源路径，必填项，无默认值
+ `destination` 静态资源需要拷贝到的目标路径，必填项，无默认值
+ `gitDir` 执行git命令的根路径，默认是publish
+ `branch` 执行git命令的分支名，默认是master
+ `version` 自动提交时的版本号，默认是当前时间的毫秒数
+ `remove` 是否删除旧文件，默认是删除

```js
// 引入
const CopyThenAutoGit = require('copy-then-auto-git');

// 配置 Plugin
const copyThenAutoGit = new CopyThenAutoGit({
    source: 'build',
    destination: 'publish/www',
    gitDir: 'publish',
    branch: 'dev',
    version: new Date().getTime(),
    remove: false
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
