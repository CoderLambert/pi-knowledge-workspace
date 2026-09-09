# Node.js v22.3.0 fs/promises 邻近 API（challenge A）

## fsPromises.access
`fsPromises.access()` 检查路径是否满足指定访问模式，并在检查失败时拒绝 Promise。它通常用于权限或存在性探测，但竞态敏感的流程不应先检查再执行实际文件操作。

## fsPromises.appendFile
`fsPromises.appendFile()` 将数据追加到文件。选项可包含编码与写入相关配置，完成后 Promise 以 `undefined` 结束。

## fsPromises.chmod
`fsPromises.chmod()` 修改路径对应文件的权限位。它接受 mode 参数，并异步完成权限更新。

## fsPromises.chown
`fsPromises.chown()` 修改文件的用户与组所有权。调用需要提供 uid 与 gid，并返回表示异步完成状态的 Promise。

## fsPromises.copyFile
`fsPromises.copyFile()` 复制单个文件内容到目标路径。它可以通过 mode 标志控制目标已存在等行为，但它不是目录树复制接口。

## fsPromises.lstat
`fsPromises.lstat()` 返回路径本身的文件状态信息；对于符号链接，它描述链接而不是自动跟随到最终目标。

## fsPromises.mkdir
`fsPromises.mkdir()` 创建目录。`recursive` 选项用于创建缺失的父级路径；未启用递归时，父目录缺失会导致失败。

## fsPromises.mkdtemp
`fsPromises.mkdtemp()` 基于给定前缀创建唯一临时目录，并返回新目录路径。可通过编码选项控制返回值形式。

## fsPromises.open
`fsPromises.open()` 打开文件并返回 `FileHandle`。调用方应显式关闭句柄，避免依赖运行时的回收行为释放底层文件描述符。

## fsPromises.opendir
`fsPromises.opendir()` 打开目录并返回异步目录句柄。目录句柄可以异步迭代目录项，并应在不再使用时关闭。
