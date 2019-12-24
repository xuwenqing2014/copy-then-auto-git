/*
 * @file: webpack插件-拷贝编译完成的静态资源，并自动将静态资源提交到远程仓库
 */
const fs = require('fs');
const path = require('path');
const colors = require('colors');
const mkdirs = require('jm-mkdirs');
const exec = require('child_process').exec;

class CopyThenAutoGit {
    constructor(options) {
        this.options = Object.assign({}, options);
    }

    apply(compiler) {
        let {
            assetsDir = 'publish',
            gitDir = 'publish',
            inculdes,
            exculdes,
            retry = 3,
            branch = 'master',
            version = new Date().getTime()
        } = this.options;
        
        // 回退到项目根路径
        const upToRoot = '../../';

        /**
         * 拷贝文件到{assetsDir}文件夹
         * @param {*} compilation webpack编译类
         * @param {*} callback  插件任务完成后的回调
         */
        const copyFiles = (compilation, callback) => {
            let assets = compilation.assets;
            let filesNames = Object.keys(assets);
            let _files = filesNames;
            if (inculdes) {
                inculdes.forEach(item => {
                    _files = _files.filter(e => item.test(e));
                });
            }
            if (exculdes) {
                exculdes.forEach(item => {
                    _files = _files.filter(e => !item.test(e));
                });
            }
            let _failedFiles = [];
            let _retryCount = 0;

            // 删除文件函数
            const _delDir = (path) => {
                let files = [];
                if (fs.existsSync(path)) {
                    files = fs.readdirSync(path);
                    files.forEach(file => {
                        let curPath = path + '/' + file;
                        if (fs.statSync(curPath).isDirectory()) {
                            _delDir(curPath); //递归删除文件夹
                        } else {
                            fs.unlinkSync(curPath); //删除文件
                        }
                    });
                    fs.rmdirSync(path);
                }
            };

            // 单个文件移动复制函数
            const _copyFile = (name) => {
                return new Promise((resolve, reject) => {
                    let names = name.split('/');
                    names.pop();
                    mkdirs.sync(path.resolve(__dirname, upToRoot + assetsDir + names.join('/')));
                    fs.writeFile(
                        path.resolve(__dirname, upToRoot + assetsDir + name),
                        assets[name]['source'](), 'utf8',
                        err => {
                            let fi = _failedFiles.indexOf(name);
                            if (err) {
                                console.log('\n', colors.red(`${name}:拷贝失败`), '\n', err, '\n');
                                if (fi == -1) {
                                    _failedFiles.push(name);
                                }
                                reject(err);
                            } else {
                                console.log('\n', colors.green(`${name}:拷贝成功`), '\n');
                                if (fi != -1) {
                                    _failedFiles.splice(fi, 1);
                                }
                                resolve();
                            }
                        }
                    )
                });
            }

            // 文件移动复制进程
            const _cpoyProcess = () => {
                return Promise.all(
                    _files.map(e => _copyFile(e)))
                    .then(rs => {
                        Promise.resolve(rs);
                    },
                        _finish
                    )
            }

            // 文件复制失败重试 最多重试{retry}次数
            const _retryProcess = (err) => {
                ++_retryCount;
                if (err && _retryCount > retry) {
                    console.log('\n');
                    return Promise.reject(err);
                } else if (_failedFiles.length && _retryCount <= retry) {
                    return Promise.all(_failedFiles.map(e => _copyFile(e)))
                        .then(rs => Promise.resolve(rs), _retryProcess);
                } else {
                    return Promise.resolve();
                }
            }

            // 复制完成
            const _finish = (err) => {
                if (err) {
                    console.log('\n', colors.red.underline(err), '\n');
                } else {
                    console.log('\n', colors.green('静态资源已成功移入assetsDir中'), '\n');
                }
                callback(err);
            };

            // 清空文件夹
            _delDir(path.resolve(__dirname, assetsDir.replace(/\/$/, '')));

            // 拷贝进程开始
            _cpoyProcess().then(() => {
                return _retryProcess();
            }, _retryProcess).then(() => {
                _finish();
            }, _finish);
        }

        /**
         * git切换分支,提交操作
         * @param {*} compilation webpack编译类
         * @param {*} callback  插件任务完成后的回调
         */
        const gitOperate = (compilation, callback) => {
            exec(`git checkout ${branch}`, {
                cwd: path.resolve(__dirname, upToRoot + gitDir)
            }, error => {
                if (error) {
                    console.log(colors.red.underline(error));
                    callback();
                    return;
                } else {
                    console.log(colors.yellow.underline(`当前分支:${branch}`));
                    //分支切换完成，移动复制打包代码
                    copyFiles(compilation, () => {
                        exec(`git add . && git commit -a -m 'auto-${branch}-git-${version}'`, {
                            cwd: path.resolve(__dirname, upToRoot + gitDir)
                        }, error => {
                            if (error) {
                                console.log(colors.red.underline(error));
                                callback();
                                return
                            } else {
                                console.log(colors.green('commit成功'));
                                exec('git push', {
                                    cwd: path.resolve(__dirname, upToRoot + gitDir)
                                }, error => {
                                    if (error) {
                                        console.log(colors.red.underline(error));
                                        callback();
                                        return
                                    } else {
                                        console.log(colors.green('push成功'));
                                        callback();
                                    }
                                });
                            }
                        });
                    });
                }
            });
        }
        if (compiler.hooks) { // For webpack >= 4
            compiler.hooks.afterEmit.tapAsync('gitOperate', gitOperate);
        } else { // For webpack < 4
            compiler.plugin('after-emit', gitOperate);
        }
    }
}
module.exports = CopyThenAutoGit;