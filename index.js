
/*
 * @file: webpack插件-拷贝编译完成的静态资源，并自动将静态资源提交到远程仓库
 */
const colors = require('colors');
const exec = require('child_process').exec;
const fs = require('fs');
const path = require('path');
const cpx = require('cpx');
const fsExtra = require('fs-extra');
const makeDir = require('make-dir');
const rimraf = require('rimraf');

class CopyThenAutoGit {
    constructor(options) {
        this.options = Object.assign({}, options);
    }

    apply(compiler) {
        let {
            gitDir = 'publish',
            branch = 'master',
            version = new Date().getTime(),
            source,
            destination
        } = this.options;

        /**
         * 执行拷贝操作
         *
         * @param {string} source - 被拷贝的路径
         * @param {string} destination - 目标路径
         * @return {Promise} - promise
         */
        function copyAction(source, destination) {
            return new Promise((resolve, reject) => {
                if (!source || !destination) {
                    console.log(colors.red.underline('copy-then-auto-git --- 请配置正确的拷贝参数'));
                    reject();
                    return;
                }
                let fileRegex = /(\*|\{+|\}+)/g;
                let matches = fileRegex.exec(source);
                if (matches === null) {
                    fs.lstat(source, (sErr, sStats) => {
                        if (sErr) return reject(sErr);

                        fs.lstat(destination, (dErr, dStats) => {
                            if (sStats.isFile()) {
                                let newDestination = dStats && dStats.isDirectory() ? destination + '/' + path.basename(source) : destination;

                                let pathInfo = path.parse(newDestination);

                                let execCopy = (src, dest) => {
                                    fsExtra.copy(src, dest, err => {
                                        if (err) reject(err);
                                        resolve();
                                    });
                                };

                                if (pathInfo.ext === '') {
                                    makeDir(newDestination).then(() => {
                                        execCopy(source, newDestination + '/' + path.basename(source));
                                    });
                                } else {
                                    execCopy(source, newDestination);
                                }
                            } else {
                                let sourceDir = source + (source.substr(-1) !== '/' ? '/' : '') + '**/*';
                                copyDirectory(sourceDir, destination, resolve, reject);
                            }
                        });
                    });
                } else {
                    copyDirectory(source, destination, resolve, reject);
                }
            });
        }

        /**
         * 执行拷贝文件夹
         *
         * @param {string} source - 被拷贝的路径
         * @param {string} destination - 目标路径
         * @param {Function} resolve - promise resolve
         * @param {Function} reject - promise reject
         * @return {void}
         */
        function copyDirectory(source, destination, resolve, reject) {
            let cpxOptions = {
                clean: false,
                includeEmptyDirs: true,
                update: false
            };

            cpx.copy(source, destination, cpxOptions, err => {
                if (err) {
                    reject(err);
                }
                resolve();
            });
        }

        /**
         * 删除操作
         * @param {string} destination - 目标路径
         * @return {Promise} - promise
         */
        function deleteAction(destination) {
            return new Promise((resolve, reject) => {
                if (typeof destination !== 'string') {
                    console.log(colors.red(`copy-then-auto-git --- 请配置正确的目标路径`));
                    reject();
                }
                rimraf(destination, {}, err => {
                    if (err) {
                        reject();
                    }
                    resolve();
                });
            });
        }
        /**
         * 将命令行操作promisefy
         * @param {string} command - 命令行指令
         * @param {string} cwd - 命令行的路径
         * @return {Promise} - promise
         */
        function execPromise(command, cwd) {
            return new Promise((resolve, reject) => {
                exec(command, { cwd }, async err => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        }
        /**
         * git切换分支,提交操作
         * @param {*} compilation - webpack编译类
         * @param {*} callback - 插件任务完成后的回调
         */
        const gitOperate = async (compilation, callback) => {
            const cwd = path.resolve(__dirname, '../../', gitDir);
            // 切换分支
            try {
                await execPromise(`git checkout ${branch}`, cwd);
                console.log(colors.yellow.underline(`copy-then-auto-git --- 切换分支成功，当前分支:${branch}`));
            } catch (err) {
                console.log(colors.red.underline(`copy-then-auto-git --- 切换${branch}分支失败`), err);
                callback();
                return;
            }
            // 拉取远程分支代码
            try {
                await execPromise(`git pull origin ${branch}`, cwd);
                console.log(colors.yellow.underline(`copy-then-auto-git --- pull 远程仓库${branch}分支成功`));
            } catch (err) {
                console.log(colors.red.underline(`copy-then-auto-git --- pull 远程仓库${branch}分支失败`, err));
                callback();
                return;
            }
            // 删除目标路径资源
            try {
                await deleteAction(destination);
                console.log(colors.yellow.underline(`copy-then-auto-git --- 删除${destination}成功`));
            } catch (err) {
                console.log(colors.red.underline(`copy-then-auto-git --- 删除${destination}失败`), err);
                callback();
                return;
            }
            // 拷贝资源到目标路径
            try {
                await copyAction(source, destination);
                console.log(colors.yellow.underline(`copy-then-auto-git --- 拷贝${source}资源到${destination}成功`));
            } catch (err) {
                console.log(colors.red.underline(`copy-then-auto-git --- 拷贝${source}资源到${destination}失败`), err);
                callback();
                return;
            }
            // add+commit
            try {
                await execPromise(`git add . && git commit -a -m 'auto-${branch}-git-${version}'`, cwd);
                console.log(colors.yellow.underline(`copy-then-auto-git --- commit到${branch}分支成功`));
            } catch (err) {
                console.log(colors.red.underline(`copy-then-auto-git --- commit到${branch}分支失败`), err);
                callback();
                return;
            }
            // push到远程分支
            try {
                await execPromise(`git push origin ${branch}`, cwd);
                console.log(colors.yellow.underline(`copy-then-auto-git --- push到远程仓库${branch}分支成功`));
            } catch (err) {
                console.log(colors.red.underline(`copy-then-auto-git --- push到远程仓库${branch}分支失败`), err);
                callback();
                return;
            }
            console.log(colors.green(`copy-then-auto-git --- 自动化部署成功`));
            callback();
        }
        if (compiler.hooks) { // webpack >= 4
            compiler.hooks.afterEmit.tapAsync('gitOperate', gitOperate);
        } else { // webpack < 4
            compiler.plugin('after-emit', gitOperate);
        }
    }
}
module.exports = CopyThenAutoGit;
