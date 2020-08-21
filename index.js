
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
            if (!source || !destination) {
                console.log(colors.red.underline('copy-then-auto-git --- 请输入配置的拷贝参数'));
                return null;
            }

            return new Promise(function (resolve, reject) {
                let fileRegex = /(\*|\{+|\}+)/g;
                let matches = fileRegex.exec(source);
                if (matches === null) {
                    fs.lstat(source, function (sErr, sStats) {
                        if (sErr) return reject(sErr);

                        fs.lstat(destination, function (dErr, dStats) {
                            if (sStats.isFile()) {
                                let newDestination = dStats && dStats.isDirectory() ? destination + '/' + path.basename(source) : destination;

                                let pathInfo = path.parse(newDestination);

                                let execCopy = function execCopy(src, dest) {
                                    fsExtra.copy(src, dest, function (err) {
                                        if (err) reject(err);
                                        resolve();
                                    });
                                };

                                if (pathInfo.ext === '') {
                                    makeDir(newDestination).then(function (mPath) {
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

            cpx.copy(source, destination, cpxOptions, function (err) {
                if (err) {
                    console.log(colors.red.underline('copy-then-auto-git --- 拷贝失败'), err);
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
            return new Promise(function (resolve, reject) {
                if (typeof destination !== 'string') {
                    console.log(colors.red(`copy-then-auto-git --- 请配置正确的目标路径`));
                    reject();
                }
                rimraf(destination, {}, function (response) {
                    if (response === null) {
                        console.log(colors.green(`copy-then-auto-git --- 删除成功`));
                    } else {
                        console.log(colors.red(`copy-then-auto-git --- 删除失败`));
                    }
                    resolve();
                });
            });
        }

        /**
         * git切换分支,提交操作
         * @param {*} compilation webpack编译类
         * @param {*} callback  插件任务完成后的回调
         */
        const gitOperate = (compilation, callback) => {
            exec(`git checkout ${branch}`, {
                cwd: path.resolve(__dirname, '../../', gitDir)
            }, async error => {
                if (error) {
                    console.log(colors.red.underline('copy-then-auto-git --- 切换分支失败'), error);
                    callback();
                    return;
                } else {
                    console.log(colors.yellow.underline(`copy-then-auto-git --- 当前分支:${branch}`));
                    try {
                        await deleteAction(destination);
                    } catch (error) {
                        console.log(colors.red.underline('copy-then-auto-git --- 删除失败'), error);
                        callback();
                        return;
                    }
                    try {
                        await copyAction(source, destination);
                    } catch (error) {
                        console.log(colors.red.underline('copy-then-auto-git --- 拷贝失败'), error);
                        callback();
                        return;
                    }
                    
                    console.log(colors.green(`copy-then-auto-git --- 拷贝资源到${branch}分支成功`));
                    exec(`git add . && git commit -a -m 'auto-${branch}-git-${version}'`, {
                        cwd: path.resolve(__dirname, '../../', gitDir)
                    }, error => {
                        if (error) {
                            console.log(colors.red.underline('copy-then-auto-git --- commit失败'), error);
                            callback();
                            return;
                        } else {
                            console.log(colors.green(`copy-then-auto-git --- commit到${branch}分支成功`));
                            exec('git push', {
                                cwd: path.resolve(__dirname, '../../', gitDir)
                            }, error => {
                                if (error) {
                                    console.log(colors.red.underline('copy-then-auto-git --- push失败'), error);
                                    callback();
                                    return;
                                } else {
                                    console.log(colors.green(`copy-then-auto-git --- push到${branch}分支成功`));
                                    callback();
                                }
                            });
                        }
                    });
                }
            });
        }
        if (compiler.hooks) { // webpack >= 4
            compiler.hooks.afterEmit.tapAsync('gitOperate', gitOperate);
        } else { // webpack < 4
            compiler.plugin('after-emit', gitOperate);
        }
    }
}
module.exports = CopyThenAutoGit;